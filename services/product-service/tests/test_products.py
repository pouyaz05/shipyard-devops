import pytest

BASE = "/api/product-service/products"


def slugs(body):
    return [item["slug"] for item in body["items"]]


def test_list_default_is_newest_first(client, catalog):
    response = client.get(BASE)
    assert response.status_code == 200
    body = response.json()
    assert (body["total"], body["page"], body["page_size"]) == (5, 1, 20)
    assert slugs(body)[0] == "bmp280-sensor"
    assert slugs(body)[-1] == "arduino-uno"


def test_pagination(client, catalog):
    params = {"page_size": 2, "sort": "created_at"}
    page2 = client.get(BASE, params={**params, "page": 2}).json()
    assert slugs(page2) == ["dht22-sensor", "hc-sr04-ultrasonic"]
    assert page2["total"] == 5
    assert slugs(client.get(BASE, params={**params, "page": 3}).json()) == ["bmp280-sensor"]
    assert client.get(BASE, params={**params, "page": 4}).json()["items"] == []


@pytest.mark.parametrize(
    "params", [{"page": 0}, {"page_size": 0}, {"page_size": 101}, {"sort": "name"}]
)
def test_invalid_query_params(client, catalog, params):
    assert client.get(BASE, params=params).status_code == 422


def test_filter_by_category(client, catalog):
    body = client.get(BASE, params={"category": "sensors"}).json()
    assert body["total"] == 3
    assert {item["category"]["slug"] for item in body["items"]} == {"sensors"}
    assert client.get(BASE, params={"category": "nope"}).json()["total"] == 0


def test_search_is_case_insensitive(client, catalog):
    assert client.get(BASE, params={"q": "SENSOR"}).json()["total"] == 3
    assert slugs(client.get(BASE, params={"q": "arduino"}).json()) == ["arduino-uno"]


def test_search_treats_wildcards_literally(client, catalog):
    assert client.get(BASE, params={"q": "%"}).json()["total"] == 0
    assert client.get(BASE, params={"q": "_"}).json()["total"] == 0


def test_search_combines_with_category(client, catalog):
    body = client.get(BASE, params={"q": "esp", "category": "boards"}).json()
    assert slugs(body) == ["esp32-devkit"]
    assert client.get(BASE, params={"q": "esp", "category": "sensors"}).json()["total"] == 0


def test_sort_by_price(client, catalog):
    asc = [i["price_cents"] for i in client.get(BASE, params={"sort": "price"}).json()["items"]]
    assert asc == [300, 450, 650, 900, 2700]
    desc = [i["price_cents"] for i in client.get(BASE, params={"sort": "-price"}).json()["items"]]
    assert desc == [2700, 900, 650, 450, 300]


def test_get_product_by_slug(client, catalog):
    response = client.get(f"{BASE}/esp32-devkit")
    assert response.status_code == 200
    body = response.json()
    assert body["sku"] == "B-2"
    assert body["price_cents"] == 900
    assert body["currency"] == "USD"
    assert body["category"]["slug"] == "boards"


def test_get_product_not_found(client, catalog):
    response = client.get(f"{BASE}/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"detail": "Product not found"}


def test_list_categories(client, catalog):
    response = client.get("/api/product-service/categories")
    assert response.status_code == 200
    assert [c["name"] for c in response.json()] == ["Boards", "Sensors"]
