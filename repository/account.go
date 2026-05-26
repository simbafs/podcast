package repository

import (
	"context"
	"database/sql"

	"podcast/db"
	"podcast/domain"

	"github.com/google/uuid"
	"github.com/samber/do/v2"
	"github.com/samber/oops"
)

type Account interface {
	Create(ctx context.Context) (*domain.Account, error)
	Get(ctx context.Context, id string) (*domain.Account, error)
	Update(ctx context.Context, account *domain.Account) error
	Delete(ctx context.Context, id string) error
	UpdatePosition(ctx context.Context, id string, episodeID string, position float64) error
	UpdateRSS(ctx context.Context, id string, url string) error
}

type accountSqlite struct {
	sql *db.Queries
}

func NewAccountSqlite(i do.Injector) (Account, error) {
	d := do.MustInvoke[*sql.DB](i)
	return &accountSqlite{sql: db.New(d)}, nil
}

func toDomain(a db.Account) *domain.Account {
	return &domain.Account{
		ID:             a.ID,
		RSSURL:         a.RssUrl,
		Order:          a.OrderDir,
		CurrentEpisode: a.CurrentEpisodeID,
		Position:       a.PositionSec,
	}
}

func (a *accountSqlite) Create(ctx context.Context) (*domain.Account, error) {
	account, err := a.sql.CreateAccount(ctx, uuid.NewString())
	if err != nil {
		return nil, oops.
			In("repository").
			Tags("database", "sqlite").
			Wrapf(err, "create account")
	}
	return toDomain(account), nil
}

func (a *accountSqlite) Get(ctx context.Context, id string) (*domain.Account, error) {
	account, err := a.sql.GetAccount(ctx, id)
	if err != nil {
		return nil, oops.
			In("repository").
			Tags("database", "sqlite").
			With("account_id", id).
			Wrapf(err, "get account")
	}
	return toDomain(account), nil
}

func (a *accountSqlite) Update(ctx context.Context, account *domain.Account) error {
	_, err := a.sql.UpdateAccount(ctx, db.UpdateAccountParams{
		RssUrl:           account.RSSURL,
		OrderDir:         account.Order,
		CurrentEpisodeID: account.CurrentEpisode,
		PositionSec:      account.Position,
		ID:               account.ID,
	})
	if err != nil {
		return oops.
			In("repository").
			Tags("database", "sqlite").
			With("account_id", account.ID).
			Wrapf(err, "update account")
	}
	return nil
}

func (a *accountSqlite) Delete(ctx context.Context, id string) error {
	if err := a.sql.DeleteAccount(ctx, id); err != nil {
		return oops.
			In("repository").
			Tags("database", "sqlite").
			With("account_id", id).
			Wrapf(err, "delete account")
	}
	return nil
}

func (a *accountSqlite) UpdateRSS(ctx context.Context, id string, url string) error {
	if err := a.sql.UpdateRSS(ctx, db.UpdateRSSParams{
		RssUrl: url,
		ID:     id,
	}); err != nil {
		return oops.
			In("repository").
			Tags("database", "sqlite").
			With("account_id", id).
			Wrapf(err, "update rss")
	}
	return nil
}

func (a *accountSqlite) UpdatePosition(ctx context.Context, id string, episodeID string, position float64) error {
	if err := a.sql.UpdatePosition(ctx, db.UpdatePositionParams{
		CurrentEpisodeID: episodeID,
		PositionSec:      position,
		ID:               id,
	}); err != nil {
		return oops.
			In("repository").
			Tags("database", "sqlite").
			With("account_id", id).
			With("episode_id", episodeID).
			Wrapf(err, "update position")
	}
	return nil
}
