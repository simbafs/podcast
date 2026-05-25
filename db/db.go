// Package db open and close the database connection
package db

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

type DB struct {
	db *sql.DB
}

func Must() *DB {
	db, err := sql.Open("sqlite", "file:podcast.db") // TODO: maybe add some options
	if err != nil {
		panic(err)
	}

	return &DB{db: db}
}
