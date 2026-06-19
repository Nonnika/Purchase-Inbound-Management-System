package database

import "database/sql"

type Client struct {
	DB *sql.DB
}

func NewClient(db *sql.DB) *Client {
	return &Client{db}
}
