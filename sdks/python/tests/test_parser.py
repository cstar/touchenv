"""Tests for the dotenv parser."""

from touchenv.parser import parse


def test_basic_key_value():
    assert parse("KEY=value") == {"KEY": "value"}


def test_comments_and_blanks():
    text = "# comment\n\nKEY=val\n"
    assert parse(text) == {"KEY": "val"}


def test_double_quoted():
    assert parse('KEY="hello world"') == {"KEY": "hello world"}


def test_double_quoted_escapes():
    assert parse('KEY="line1\\nline2"') == {"KEY": "line1\nline2"}
    assert parse('KEY="tab\\there"') == {"KEY": "tab\there"}
    assert parse('KEY="back\\\\"') == {"KEY": "back\\"}
    assert parse('KEY="say \\"hi\\""') == {"KEY": 'say "hi"'}


def test_single_quoted_literal():
    assert parse("KEY='no \\n escape'") == {"KEY": "no \\n escape"}


def test_export_prefix():
    assert parse("export KEY=val") == {"KEY": "val"}


def test_empty_value():
    assert parse("KEY=") == {"KEY": ""}


def test_duplicate_last_wins():
    assert parse("KEY=first\nKEY=second") == {"KEY": "second"}


def test_unquoted_trimmed():
    assert parse("KEY=  spaces around  ") == {"KEY": "spaces around"}


def test_invalid_key_skipped():
    assert parse("123BAD=val\nGOOD=ok") == {"GOOD": "ok"}


def test_no_equals_skipped():
    assert parse("NOEQ\nKEY=val") == {"KEY": "val"}
