import psycopg
from psycopg.rows import dict_row
from contextlib import contextmanager
from config import Config


def get_connection():
    return psycopg.connect(Config.get_db_dsn(), row_factory=dict_row)


@contextmanager
def db_cursor(commit: bool = False):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
            if commit:
                conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_one(query: str, params: tuple = ()):
    with db_cursor() as cur:
        cur.execute(query, params)
        return cur.fetchone()


def fetch_all(query: str, params: tuple = ()):
    with db_cursor() as cur:
        cur.execute(query, params)
        return cur.fetchall()


def execute(query: str, params: tuple = (), returning: bool = False):
    with db_cursor(commit=True) as cur:
        cur.execute(query, params)
        if returning:
            return cur.fetchone()
        return cur.rowcount