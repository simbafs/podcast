package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
}

func Must() *DB {
	db, err := sql.Open("sqlite", "file:podcast.db")
	if err != nil {
		panic(err)
	}
	return &DB{db: db}
}

func (d *DB) SQLDB() *sql.DB {
	return d.db
}
