import uuid

from app.core.security import decode_user_id


def test_valid_token_returns_user_id(make_token):
    user_id = uuid.uuid4()
    assert decode_user_id(make_token(user_id)) == user_id


def test_invalid_tokens_return_none(make_token):
    tokens = {
        "garbage": "not-a-token",
        "expired": make_token(uuid.uuid4(), expires_in=-10),
        "other secret": make_token(uuid.uuid4(), secret="x" * 40),
        "wrong algorithm": make_token(uuid.uuid4(), algorithm="HS512"),
        "sub is not a uuid": make_token("not-a-uuid"),
        "no sub": make_token(None),
    }
    for name, token in tokens.items():
        assert decode_user_id(token) is None, name
