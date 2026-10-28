#!/usr/bin/env bash
# End-to-end purchase flow against a running stack (docker compose gateway or Kubernetes ingress).
# Usage: BASE_URL=http://localhost:8080 ./scripts/e2e.sh   (needs curl and python3; run `make seed` first)
set -euo pipefail

BASE="${BASE_URL:-http://localhost:8080}"
TOKEN=""
CODE=""
BODY=""

fail() { echo "FAIL: $*" >&2; exit 1; }
step() { echo "==> $*"; }
jget() { python3 -c "import sys, json; print(json.load(sys.stdin)$1)"; }

# call METHOD PATH [JSON_BODY]  ->  sets CODE and BODY
call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method" -H "Content-Type: application/json" -w $'\n%{http_code}')
  if [[ -n "$TOKEN" ]]; then args+=(-H "Authorization: Bearer $TOKEN"); fi
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  local out
  out="$(curl "${args[@]}" "$BASE$path")"
  CODE="${out##*$'\n'}"
  BODY="${out%$'\n'*}"
}

# expect REGEX_OF_ALLOWED_CODES WHAT
expect() { [[ "$CODE" =~ ^($1)$ ]] || fail "$2: expected HTTP $1, got $CODE: $BODY"; }

step "Waiting for the stack at $BASE"
code=""
for _ in $(seq 1 60); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/product-service/products?page_size=1" || true)"
  [[ "$code" == "200" ]] && break
  sleep 2
done
[[ "$code" == "200" ]] || fail "stack not ready (last HTTP status: $code)"

EMAIL="e2e-$(date +%s)-$RANDOM@example.com"
PASSWORD="Test1234!"

step "Register $EMAIL"
call POST /api/user-service/auth/register "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"E2E Tester\"}"
expect 201 "register"

step "Login"
call POST /api/user-service/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
expect 200 "login"
TOKEN="$(echo "$BODY" | jget "['access_token']")"

step "Cart requires a token"
SAVED="$TOKEN"; TOKEN=""
call GET /api/cart-service/cart
expect 401 "cart without token"
TOKEN="$SAVED"

step "Pick a product"
call GET "/api/product-service/products?page_size=1"
expect 200 "list products"
read -r PID STOCK < <(echo "$BODY" | python3 -c "import sys, json; i = json.load(sys.stdin)['items']; i and print(i[0]['id'], i[0]['stock'])") \
  || fail "no products found, run: make seed"
echo "    product=$PID stock=$STOCK"

OVER=$((STOCK + 1))
if (( OVER <= 1000 )); then
  step "Adding more than the stock is refused"
  call POST /api/cart-service/cart/items "{\"product_id\":\"$PID\",\"quantity\":$OVER}"
  expect 409 "oversell"
fi

step "Add 2 to the cart"
call POST /api/cart-service/cart/items "{\"product_id\":\"$PID\",\"quantity\":2}"
expect "200|201" "add to cart"

step "Checkout"
call POST /api/order-service/orders '{"shipping_name":"E2E","shipping_address":"1 Main St","shipping_city":"Berlin"}'
expect 201 "create order"
OID="$(echo "$BODY" | jget "['id']")"
[[ "$(echo "$BODY" | jget "['status']")" == "PENDING_PAYMENT" ]] || fail "new order should be PENDING_PAYMENT: $BODY"

step "Cart is emptied after checkout"
call GET /api/cart-service/cart
expect 200 "get cart"
[[ "$(echo "$BODY" | jget "['total_cents']")" == "0" ]] || fail "cart should be empty: $BODY"

step "Stock was reduced by 2"
call GET "/api/product-service/products/by-id/$PID"
expect 200 "get product"
NEW_STOCK="$(echo "$BODY" | jget "['stock']")"
(( NEW_STOCK == STOCK - 2 )) || fail "stock should be $((STOCK - 2)), got $NEW_STOCK"

step "Pay (simulated), then paying again is refused"
call POST "/api/order-service/orders/$OID/pay"
expect 200 "pay"
[[ "$(echo "$BODY" | jget "['status']")" == "PAID" ]] || fail "order should be PAID: $BODY"
call POST "/api/order-service/orders/$OID/pay"
expect 409 "pay twice"

step "Internal endpoints are not reachable from outside"
call POST "/internal/products/$PID/decrement" '{"quantity":1}'
expect "404|405" "internal endpoint exposure"

echo "ALL CHECKS PASSED"
