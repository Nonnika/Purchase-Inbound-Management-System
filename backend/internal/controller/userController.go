package controller

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
)

// UserController 用于处理 Users 表相关的请求
type UserController struct {
	dao *dao.UserDao
}

func NewUserController(dao *dao.UserDao) *UserController {
	return &UserController{dao: dao}
}

func (u *UserController) SelectAll(ctx *gin.Context) {
	rows, err := u.dao.SelectAll()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
	}

	ctx.JSON(http.StatusOK, rows)

}

func (u *UserController) SelectById(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Query("id"))
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	row, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, row)
}

func (u *UserController) RegisterRouter(r *gin.RouterGroup) {
	r.GET("/users/selectAll", u.SelectAll)
	r.GET("/users/selectById", u.SelectById)
}
