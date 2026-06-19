package main

import (
	"log"

	"github.com/gin-gonic/gin"
)

func helloHandler(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "hello world",
	})
}

func main() {
	r := gin.Default()

	r.GET("/", helloHandler)

	log.Fatal(r.Run(":8080"))
}
