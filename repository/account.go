package repository

import (
	"context"

	"podcast/db"
	"podcast/domain"

	"github.com/google/uuid"
	"github.com/samber/do/v2"
)

type Account interface {
	Create(ctx context.Context) (*domain.Account, error)
	Get(ctx context.Context, id string) (*domain.Account, error)
	Update(ctx context.Context, account *domain.Account) error
	Delete(ctx context.Context, id string) error
}

type accountSqlite struct {
	db  *db.DB
	sql *db.Queries
}

func NewAccountSqlite(i do.Injector) (Account, error) {
	d := do.MustInvoke[*db.DB](i)
	return &accountSqlite{db: d, sql: db.New(d.SQLDB())}, nil
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
	// Before: was panic("not implemented") — sqlc handles INSERT
	account, err := a.sql.CreateAccount(ctx, uuid.NewString())
	if err != nil {
		return nil, err
	}
	return toDomain(account), nil
}

func (a *accountSqlite) Get(ctx context.Context, id string) (*domain.Account, error) {
	account, err := a.sql.GetAccount(ctx, id)
	if err != nil {
		return nil, err
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
	return err
}

func (a *accountSqlite) Delete(ctx context.Context, id string) error {
	return a.sql.DeleteAccount(ctx, id)
}
