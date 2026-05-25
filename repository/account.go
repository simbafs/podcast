// Package repository defines the interface and the implementation of the repository layer, wihch is responsible for interacting with the underlaying data storage
package repository

import (
	"context"

	"podcast/domain"

	"github.com/samber/do/v2"
)

type Account interface {
	Create(ctx context.Context) (string, error) // return id
	Get(ctx context.Context, id string) (*domain.Account, error)
	Update(ctx context.Context, account *domain.Account) error
	Delete(ctx context.Context, id string) error
}

type accountSqlite struct{}

func NewAccountSqlite(i do.Injector) (Account, error) {
	return &accountSqlite{}, nil
}

func (a *accountSqlite) Create(ctx context.Context) (string, error) {
	panic("not implemented") // TODO: Implement
}

func (a *accountSqlite) Get(ctx context.Context, id string) (*domain.Account, error) {
	panic("not implemented") // TODO: Implement
}

func (a *accountSqlite) Update(ctx context.Context, account *domain.Account) error {
	panic("not implemented") // TODO: Implement
}

func (a *accountSqlite) Delete(ctx context.Context, id string) error {
	panic("not implemented") // TODO: Implement
}
