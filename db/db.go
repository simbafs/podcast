package db

import (
	"database/sql"
	"fmt"
	_ "embed"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed schema.sql
var schemaSQL string

var DB *sql.DB

func Init(dbPath string) error {
	if dbPath == "" {
		dbPath = "./data/podcast.db"
	}

	dir := fmt.Sprintf("%s", dbPath[:len(dbPath)-len("/podcast.db")])
	os.MkdirAll(dir, 0755)

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=ON")
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err := initSchema(); err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	return nil
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

func GetDB() *sql.DB {
	return DB
}

func initSchema() error {
	_, err := DB.Exec(schemaSQL)
	return err
}
