"""Which chat models the agent gets, depending on the keys configured."""

import pytest
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

from ai import models
from database.config import settings


@pytest.fixture(autouse=True)
def fresh_models() -> object:
    models.get_chat_models.cache_clear()
    yield
    models.get_chat_models.cache_clear()


def test_openai_first_and_groq_as_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "sk-test")
    monkeypatch.setattr(settings, "groq_api_key", "gsk-test")

    chat, fallback = models.get_chat_models()

    assert isinstance(chat, ChatOpenAI)
    assert chat.model_name == settings.chat_model
    assert isinstance(fallback, ChatGroq)
    assert fallback.model_name == settings.fallback_chat_model


def test_one_key_is_enough(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "gsk-test")

    (only,) = models.get_chat_models()

    assert isinstance(only, ChatGroq)


def test_without_keys_the_ai_is_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "groq_api_key", "")

    with pytest.raises(models.AIConfigError, match="OPENAI_API_KEY or GROQ_API_KEY"):
        models.get_chat_models()
