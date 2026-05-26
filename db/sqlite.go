package db

import (
	"context"
	"database/sql"
	_ "embed"

	_ "modernc.org/sqlite"
	"github.com/samber/oops"
)

//go:embed schema.sql
var schema string

func Open() (*sql.DB, error) {
	d, err := sql.Open("sqlite", "file:podcast.db")
	if err != nil {
		return nil, oops.In("db").Tags("database", "sqlite").Wrapf(err, "open sqlite")
	}

	if _, err := d.ExecContext(context.Background(), schema); err != nil {
		d.Close()
		return nil, oops.In("db").Tags("database", "sqlite").Wrapf(err, "migrate")
	}

	return d, nil
}
