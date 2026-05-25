package db

import (
	"database/sql"
	_ "embed"
	"log"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

type DB struct {
	db *sql.DB
}

func Must() *DB {
	db, err := sql.Open("sqlite", "file:podcast.db")
	if err != nil {
		panic(err)
	}

	if _, err := db.Exec(schema); err != nil {
		log.Printf("db: migrate: %v", err)
	}

	return &DB{db: db}
}

func (d *DB) SQLDB() *sql.DB {
	return d.db
}
