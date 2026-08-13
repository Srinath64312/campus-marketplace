from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session, or_, select

from app.db import get_session
from app.models import Listing, Message, User
from app.schemas import MessageCreate, MessageOut, ThreadOut
from app.security import get_current_user
from app.services import seller_summary

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ConnectionHub:
    """Tiny in-process pub/sub so a thread updates live for both students."""

    def __init__(self) -> None:
        self._peers: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: int, socket: WebSocket) -> None:
        await socket.accept()
        self._peers[user_id].append(socket)

    def disconnect(self, user_id: int, socket: WebSocket) -> None:
        if socket in self._peers.get(user_id, []):
            self._peers[user_id].remove(socket)

    async def push(self, user_id: int, payload: dict) -> None:
        for socket in list(self._peers.get(user_id, [])):
            try:
                await socket.send_json(payload)
            except RuntimeError:
                self.disconnect(user_id, socket)


hub = ConnectionHub()


@router.get("/threads", response_model=list[ThreadOut])
def list_threads(
    session: Session = Depends(get_session), user: User = Depends(get_current_user)
) -> list[ThreadOut]:
    rows = list(
        session.exec(
            select(Message)
            .where(or_(Message.sender_id == user.id, Message.recipient_id == user.id))
            .order_by(Message.created_at)  # type: ignore[arg-type]
        )
    )
    threads: dict[tuple[int, int], list[Message]] = defaultdict(list)
    for message in rows:
        counterpart = message.recipient_id if message.sender_id == user.id else message.sender_id
        threads[(message.listing_id, counterpart)].append(message)

    out: list[ThreadOut] = []
    for (listing_id, counterpart_id), messages in threads.items():
        listing = session.get(Listing, listing_id)
        other = session.get(User, counterpart_id)
        if not listing or not other:
            continue
        last = messages[-1]
        out.append(
            ThreadOut(
                listing_id=listing_id,
                listing_title=listing.title,
                listing_image=(listing.images or [None])[0],
                counterpart=seller_summary(session, other),
                last_message=last.body,
                last_at=last.created_at,
                unread=sum(1 for m in messages if m.recipient_id == user.id and not m.read),
            )
        )
    out.sort(key=lambda t: t.last_at, reverse=True)
    return out


@router.get("/{listing_id}/{counterpart_id}", response_model=list[MessageOut])
def get_thread(
    listing_id: int,
    counterpart_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> list[MessageOut]:
    rows = list(
        session.exec(
            select(Message).where(Message.listing_id == listing_id).order_by(Message.created_at)  # type: ignore[arg-type]
        )
    )
    thread = [
        m
        for m in rows
        if {m.sender_id, m.recipient_id} == {user.id, counterpart_id} or counterpart_id == user.id
    ]
    dirty = False
    for message in thread:
        if message.recipient_id == user.id and not message.read:
            message.read = True
            session.add(message)
            dirty = True
    if dirty:
        session.commit()
    return [MessageOut.model_validate(m, from_attributes=True) for m in thread]


@router.post("", response_model=MessageOut, status_code=201)
async def send_message(
    payload: MessageCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> MessageOut:
    listing = session.get(Listing, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    if listing.seller_id == user.id:
        # Seller replying: answer the most recent counterpart on this listing.
        last = session.exec(
            select(Message)
            .where(Message.listing_id == listing.id, Message.recipient_id == user.id)
            .order_by(Message.created_at.desc())  # type: ignore[attr-defined]
        ).first()
        if not last:
            raise HTTPException(status_code=400, detail="No buyer has messaged you about this listing yet")
        recipient_id = last.sender_id
    else:
        recipient_id = listing.seller_id

    message = Message(
        listing_id=int(listing.id or 0),
        sender_id=int(user.id or 0),
        recipient_id=recipient_id,
        body=payload.body.strip(),
    )
    session.add(message)
    session.commit()
    session.refresh(message)

    out = MessageOut.model_validate(message, from_attributes=True)
    await hub.push(recipient_id, {"type": "message", "data": out.model_dump(mode="json")})
    return out


@router.websocket("/ws/{user_id}")
async def chat_socket(websocket: WebSocket, user_id: int) -> None:
    await hub.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(user_id, websocket)
