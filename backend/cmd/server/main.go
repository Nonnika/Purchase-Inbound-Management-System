package main

import (
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/nonnika/pims/internal/config"
	"github.com/nonnika/pims/internal/controller"
	"github.com/nonnika/pims/internal/database"
	"github.com/nonnika/pims/internal/database/dao"
)

func main() {
	cfg := config.NewConfig("root", "screct_root", "10086", "charset=utf8mb4&parseTime=true&loc=Local")
	cfg.Init("pims")

	client := database.NewClient(cfg)
	err := client.Init("mysql")
	if err != nil {
		return
	}

	if err := client.Connect(); err != nil {
		log.Fatal(err)
	}

	log.Printf("Database connection established successfully")

	r := gin.Default()
	api := r.Group("/api")
	userController := controller.NewUserController(&dao.UserDao{DB: client.DB})
	userController.RegisterRouter(api)

	log.Fatal(r.Run(":8080"))
}
