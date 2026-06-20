package controller

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
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

	if rows == nil {
		ctx.JSON(http.StatusInternalServerError, []model.User{})
		return
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

func (u *UserController) SelectByUserName(ctx *gin.Context) {
	user, err := u.dao.SelectByUserName(ctx.Query("username"))
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, user)
}

func (u *UserController) DeleteById(ctx *gin.Context) {
	id, err := strconv.Atoi(ctx.Query("id"))
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	affect, err := u.dao.DeleteUser(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": affect,
	})
}

func (u *UserController) Insert(ctx *gin.Context) {
	var user model.User
	err := ctx.ShouldBind(&user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	if user.Username == "" {
		log.Println("username is empty")
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "username is empty",
		})
		return
	}
	exec, err := u.dao.Insert(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": exec,
	})
}

func (u *UserController) RegisterRouter(r *gin.RouterGroup) {
	r.GET("/users/selectAll", u.SelectAll)
	r.GET("/users/selectById", u.SelectById)
	r.GET("/users/selectByUserName", u.SelectByUserName)
	r.GET("/users/deleteById", u.DeleteById)
	r.POST("/users/insert", u.Insert)
}
