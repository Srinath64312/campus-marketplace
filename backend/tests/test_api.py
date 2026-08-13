import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.main import app
from app.models import Category, Condition, Listing, ListingMode, ListingStatus, User
from app.pricing import deal_score, suggest_price
from app.search import search
from app.swaps import build_graph, find_cycles


@pytest.fixture(name="client")
def client_fixture():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def register(client: TestClient, email: str = "a@campus.ac.in", name: str = "Aarav") -> dict:
    response = client.post("/api/auth/signup", json={"email": email, "name": name, "password": "hunter2!"})
    assert response.status_code == 201, response.text
    return response.json()


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def make_listing(client: TestClient, token: str, **overrides) -> dict:
    payload = {
        "title": "Casio FX-991EX calculator",
        "description": "Exam ready, barely used",
        "price": 1000,
        "category": "calculators",
        "condition": "like_new",
        "tags": ["casio"],
    }
    payload.update(overrides)
    response = client.post("/api/listings", json=payload, headers=auth_header(token))
    assert response.status_code == 201, response.text
    return response.json()


def test_healthz(client: TestClient) -> None:
    assert client.get("/healthz").json()["status"] == "ok"


def test_signup_login_and_me(client: TestClient) -> None:
    created = register(client)
    assert created["user"]["is_email_verified"] is True

    duplicate = client.post(
        "/api/auth/signup", json={"email": "a@campus.ac.in", "name": "X", "password": "hunter2!"}
    )
    assert duplicate.status_code == 409

    login = client.post("/api/auth/login", json={"email": "a@campus.ac.in", "password": "hunter2!"})
    assert login.status_code == 200
    me = client.get("/api/auth/me", headers=auth_header(login.json()["access_token"]))
    assert me.json()["name"] == "Aarav"

    assert (
        client.post("/api/auth/login", json={"email": "a@campus.ac.in", "password": "nope"}).status_code
        == 401
    )


def test_listing_crud_and_ownership(client: TestClient) -> None:
    owner = register(client)
    intruder = register(client, "b@campus.ac.in", "Diya")

    listing = make_listing(client, owner["access_token"])
    listing_id = listing["id"]

    fetched = client.get(f"/api/listings/{listing_id}")
    assert fetched.status_code == 200
    assert fetched.json()["seller"]["name"] == "Aarav"

    patched = client.patch(
        f"/api/listings/{listing_id}", json={"price": 800}, headers=auth_header(owner["access_token"])
    )
    assert patched.json()["price"] == 800

    forbidden = client.patch(
        f"/api/listings/{listing_id}", json={"price": 1}, headers=auth_header(intruder["access_token"])
    )
    assert forbidden.status_code == 403
    assert (
        client.delete(
            f"/api/listings/{listing_id}", headers=auth_header(intruder["access_token"])
        ).status_code
        == 403
    )

    assert (
        client.delete(f"/api/listings/{listing_id}", headers=auth_header(owner["access_token"])).status_code
        == 204
    )
    assert client.get(f"/api/listings/{listing_id}").status_code == 404


def test_giveaway_price_is_forced_to_zero(client: TestClient) -> None:
    owner = register(client)
    listing = make_listing(client, owner["access_token"], mode="giveaway", price=500)
    assert listing["price"] == 0


def test_search_filter_sort_and_facets(client: TestClient) -> None:
    owner = register(client)
    make_listing(client, owner["access_token"], title="Casio FX-991EX calculator", price=1100)
    make_listing(client, owner["access_token"], title="CLRS algorithms textbook", category="books", price=850)
    make_listing(
        client, owner["access_token"], title="Hero Sprint geared cycle", category="cycles", price=6200
    )

    page = client.get("/api/listings", params={"q": "calulator"}).json()  # deliberate typo
    assert page["total"] == 1
    assert "Casio" in page["items"][0]["title"]

    books = client.get("/api/listings", params={"category": "books"}).json()
    assert books["total"] == 1
    assert books["facets"]["category"] == {"books": 1}

    cheap = client.get("/api/listings", params={"max_price": 1000, "sort": "price_asc"}).json()
    assert [x["price"] for x in cheap["items"]] == [850]

    everything = client.get("/api/listings", params={"sort": "price_desc"}).json()
    assert [x["price"] for x in everything["items"]] == [6200, 1100, 850]

    assert client.get("/api/listings", params={"sort": "bogus"}).status_code == 400


def test_wishlist_and_price_drop_alert(client: TestClient) -> None:
    seller = register(client)
    buyer = register(client, "b@campus.ac.in", "Diya")
    listing = make_listing(client, seller["access_token"])

    added = client.post(f"/api/wishlist/{listing['id']}", headers=auth_header(buyer["access_token"]))
    assert added.status_code == 201
    assert added.json()["saved"] is True

    saved = client.get("/api/wishlist", headers=auth_header(buyer["access_token"])).json()
    assert len(saved) == 1

    client.patch(
        f"/api/listings/{listing['id']}", json={"price": 500}, headers=auth_header(seller["access_token"])
    )
    alerts = client.get("/api/alerts", headers=auth_header(buyer["access_token"])).json()
    assert any(a["kind"] == "price_drop" for a in alerts)

    client.delete(f"/api/wishlist/{listing['id']}", headers=auth_header(buyer["access_token"]))
    assert client.get("/api/wishlist", headers=auth_header(buyer["access_token"])).json() == []


def test_saved_search_fires_alert_on_new_listing(client: TestClient) -> None:
    watcher = register(client, "w@campus.ac.in", "Meera")
    seller = register(client, "s@campus.ac.in", "Kabir")

    client.post(
        "/api/saved-searches",
        json={"label": "Cheap calculator", "query": "calculator", "max_price": 1500},
        headers=auth_header(watcher["access_token"]),
    )
    make_listing(client, seller["access_token"], title="Casio calculator FX-82", price=400)

    alerts = client.get("/api/alerts", headers=auth_header(watcher["access_token"])).json()
    assert any("Cheap calculator" in a["message"] for a in alerts)


def test_chat_roundtrip(client: TestClient) -> None:
    seller = register(client)
    buyer = register(client, "b@campus.ac.in", "Diya")
    listing = make_listing(client, seller["access_token"])

    sent = client.post(
        "/api/chat",
        json={"listing_id": listing["id"], "body": "Still available?"},
        headers=auth_header(buyer["access_token"]),
    )
    assert sent.status_code == 201

    reply = client.post(
        "/api/chat",
        json={"listing_id": listing["id"], "body": "Yes, canteen at 6?"},
        headers=auth_header(seller["access_token"]),
    )
    assert reply.status_code == 201

    threads = client.get("/api/chat/threads", headers=auth_header(buyer["access_token"])).json()
    assert len(threads) == 1
    assert threads[0]["last_message"] == "Yes, canteen at 6?"


def test_report_auto_hides_after_three_reports(client: TestClient) -> None:
    seller = register(client)
    listing = make_listing(client, seller["access_token"])
    for i in range(3):
        reporter = register(client, f"r{i}@campus.ac.in", f"Reporter{i}")
        result = client.post(
            "/api/reports",
            json={"listing_id": listing["id"], "reason": "spam"},
            headers=auth_header(reporter["access_token"]),
        )
        assert result.status_code == 201
    assert result.json()["auto_hidden"] is True
    assert client.get("/api/listings").json()["total"] == 0


def test_price_suggest_endpoint(client: TestClient) -> None:
    owner = register(client)
    for price in (900, 1100, 1300):
        make_listing(client, owner["access_token"], title=f"Casio calculator {price}", price=price)

    response = client.post(
        "/api/ai/price-suggest",
        json={
            "title": "Casio calculator FX-991",
            "description": "exam ready",
            "category": "calculators",
            "condition": "like_new",
            "age_months": 6,
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["low"] <= body["suggested"] <= body["high"]
    assert body["comparables"] >= 3
    assert body["rationale"]


def test_trust_and_review_flow(client: TestClient) -> None:
    seller = register(client)
    buyer = register(client, "b@campus.ac.in", "Diya")
    seller_id = seller["user"]["id"]

    assert (
        client.post(
            "/api/reviews",
            json={"seller_id": seller_id, "rating": 5, "comment": "Smooth"},
            headers=auth_header(buyer["access_token"]),
        ).status_code
        == 201
    )

    self_review = client.post(
        "/api/reviews",
        json={"seller_id": seller_id, "rating": 5},
        headers=auth_header(seller["access_token"]),
    )
    assert self_review.status_code == 400

    profile = client.get(f"/api/users/{seller_id}").json()
    assert profile["rating"] == 5.0
    assert profile["trust_score"] > 0
    assert profile["trust_signals"]


def test_stats_and_meetup_spots(client: TestClient) -> None:
    owner = register(client)
    make_listing(client, owner["access_token"])
    stats = client.get("/api/stats").json()
    assert stats["active_listings"] == 1
    assert stats["students"] == 1
    assert len(stats["daily_new"]) == 14
    assert len(client.get("/api/meetup-spots").json()) > 3


def test_swap_ring_endpoint_finds_three_way_loop(client: TestClient) -> None:
    a = register(client, "a1@campus.ac.in", "A")
    b = register(client, "b1@campus.ac.in", "B")
    c = register(client, "c1@campus.ac.in", "C")

    make_listing(
        client,
        a["access_token"],
        title="Yamaha guitar",
        category="other",
        mode="swap",
        swap_wants="cycle",
        swap_wants_category="cycles",
        tags=["guitar"],
    )
    make_listing(
        client,
        b["access_token"],
        title="Geared cycle",
        category="cycles",
        mode="swap",
        swap_wants="laptop",
        swap_wants_category="electronics",
        tags=["cycle"],
    )
    make_listing(
        client,
        c["access_token"],
        title="HP laptop",
        category="electronics",
        mode="swap",
        swap_wants="guitar",
        swap_wants_category="other",
        tags=["laptop"],
    )

    rings = client.get("/api/swaps/rings").json()
    assert any(r["length"] == 3 for r in rings)


# --- pure unit tests for the algorithms ---


def _listing(**kwargs) -> Listing:
    base = dict(
        id=kwargs.pop("id", 1),
        seller_id=kwargs.pop("seller_id", 1),
        title="item",
        description="",
        price=100.0,
        category=Category.other,
        condition=Condition.good,
        mode=ListingMode.sell,
        status=ListingStatus.active,
    )
    base.update(kwargs)
    return Listing(**base)


def test_search_is_typo_tolerant_and_synonym_aware() -> None:
    listings = [
        _listing(id=1, title="Hero Sprint bicycle", category=Category.cycles),
        _listing(id=2, title="CLRS algorithms textbook", category=Category.books),
    ]
    assert [x.id for x in search(listings, "cycle")] == [1]
    assert [x.id for x in search(listings, "algorthms")] == [2]
    assert search(listings, "") == listings


def test_deal_score_flags_underpriced_listing() -> None:
    market = [_listing(id=i, price=1000.0, category=Category.calculators, seller_id=i) for i in range(2, 8)]
    cheap = _listing(id=1, price=500.0, category=Category.calculators)
    score = deal_score(cheap, market)
    assert score is not None
    assert score.label == "steal"
    assert score.delta_percent < 0


def test_suggest_price_falls_back_to_category_baseline() -> None:
    suggestion = suggest_price(
        [], title="Unheard of gadget", description="", category=Category.cycles, condition=Condition.good
    )
    assert suggestion.comparables == 0
    assert suggestion.confidence < 0.5
    assert suggestion.suggested > 0


def test_find_cycles_ignores_self_trades() -> None:
    same_owner = [
        _listing(
            id=1,
            seller_id=1,
            mode=ListingMode.swap,
            title="guitar",
            swap_wants="cycle",
            swap_wants_category=Category.cycles,
        ),
        _listing(
            id=2,
            seller_id=1,
            mode=ListingMode.swap,
            title="cycle",
            category=Category.cycles,
            swap_wants="guitar",
            swap_wants_category=Category.other,
        ),
    ]
    assert find_cycles(build_graph(same_owner)) == []


def test_user_model_defaults() -> None:
    user = User(email="x@campus.ac.in", name="X", hashed_password="x")
    assert user.campus == "Main Campus"
    assert user.is_email_verified is False
