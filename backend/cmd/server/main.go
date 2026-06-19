package main

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/nonnika/pims/internal/database"
	"github.com/nonnika/pims/internal/database/model"
)

func helloHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "hello world",
	})
}

func main() {
	// 连接 db
	dsn := "root:screct_root@tcp(127.0.0.1:10086)/pims?charset=utf8mb4&parseTime=true&loc=Local"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}

	defer func(db *sql.DB) {
		err := db.Close()
		if err != nil {
			log.Fatal(err)
		}
	}(db)

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("Connected to database successfully!!!")

	client := database.NewClient(db)

	exec, err := client.DB.Query("select * from users")
	if err != nil {
		log.Fatal(err)
	}

	for exec.Next() {
		var user model.User
		err = exec.Scan(&user.Id, &user.Username, &user.PasswordHash, &user.RealName, &user.Phone, &user.RoleId, &user.DepartmentId, &user.DepartmentId, &user.CreatedAt, &user.UpdatedAt)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(user)
	}

	r := gin.Default()

	r.GET("/", helloHandler)

	log.Fatal(r.Run(":8080"))
}
