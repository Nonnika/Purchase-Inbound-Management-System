package database

import (
	"errors"
	"log"

	"github.com/jmoiron/sqlx"
	"github.com/nonnika/pims/internal/config"
)

type Client struct {
	DB     *sqlx.DB
	Config *config.Config
}

func NewClient(Config *config.Config) *Client {
	return &Client{nil, Config}

}

func (c *Client) Init(driver string) error {
	db, err := sqlx.Open(driver, c.Config.Dsn)
	if err != nil {
		return err
	}
	c.DB = db
	return nil
}

func (c *Client) Connect() error {
	if err := c.DB.Ping(); err != nil {
		log.Printf("Error connecting to database: %v", err)
		return errors.New("connect database error")
	}
	return nil
}

func (c *Client) Close() error {
	if c.DB != nil {
		return c.DB.Close()
	}
	return errors.New("database is not connected")
}
