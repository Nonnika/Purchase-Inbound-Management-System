package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
	"github.com/nonnika/pims/internal/config"
	"github.com/nonnika/pims/internal/controller"
	"github.com/nonnika/pims/internal/database"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/jwt"
	"github.com/nonnika/pims/internal/middleware"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file:", err.Error())
		return
	}

	cfg := config.NewConfig(os.Getenv("DB_USER"), os.Getenv("DB_PASSWD"), os.Getenv("DB_ADDR"), os.Getenv("DB_PORT"), os.Getenv("DB_PARAMS"))
	cfg.Init(os.Getenv("DB_NAME"))

	client := database.NewClient(cfg)
	err = client.Init("mysql")
	if err != nil {
		return
	}

	if err := client.Connect(); err != nil {
		log.Fatal(err)
	}
	jwtSecret := []byte(os.Getenv("JWT_SECRET"))
	if err := jwt.ValidateSecret(jwtSecret); err != nil {
		log.Fatal(err)
	}
	log.Printf("Database connection established successfully")

	jwtMgr := jwt.NewJwtManager(jwtSecret)

	r := gin.Default()
	api := r.Group("/api")
	auth := api.Group("")
	auth.Use(middleware.Auth(jwtMgr))

	userController := controller.NewUserController(&dao.UserDao{DB: client.DB}, jwtMgr)
	userController.RegisterRouter(api)
	userController.RegisterAuthRouter(auth)

	departmentController := controller.NewDepartmentController(&dao.DepartmentDao{DB: client.DB})
	departmentController.RegisterRouter(api)
	departmentController.RegisterAuthRouter(auth)

	roleController := controller.NewRoleController(&dao.RoleDao{DB: client.DB})
	roleController.RegisterAuthRouter(auth)

	orderController := controller.NewOrderController(&dao.OrderDao{DB: client.DB})
	orderController.RegisterAuthRouter(auth)

	itemController := controller.NewItemController(&dao.ItemDao{DB: client.DB})
	itemController.RegisterAuthRouter(auth)

	warehouseController := controller.NewWarehouseController(&dao.WarehouseDao{DB: client.DB})
	warehouseController.RegisterRouter(api)
	warehouseController.RegisterAuthRouter(auth)

	itemCategoryController := controller.NewItemCategoriesController(&dao.ItemCategoriesDao{DB: client.DB})
	itemCategoryController.RegisterRouter(api)
	itemCategoryController.RegisterAuthRouter(auth)

	overviewController := controller.NewOverviewController(&dao.OverviewDao{DB: client.DB})
	overviewController.RegisterAuthRouter(auth)

	log.Fatal(r.Run(":8080"))
}
