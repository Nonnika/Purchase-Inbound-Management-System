package controller

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/encode"
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
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "id is required",
		})
		return
	}
	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	row, err := u.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"message": err.Error(),
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (u *UserController) SelectByUserName(ctx *gin.Context) {
	_userName := ctx.Query("user_name")
	if _userName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "user_name is required",
		})
		return
	}

	row, err := u.dao.SelectByUserName(_userName)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"message": err.Error(),
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, row)
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

// Insert 注意 PasswordHash 应当传入 Password
func (u *UserController) Insert(ctx *gin.Context) {
	var user model.User
	err := ctx.ShouldBind(&user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
		})
		return
	}
	if user.Username == "" {
		log.Println("username is empty")
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "username is empty",
		})
		return
	}
	user.PasswordHash, err = encode.EncodePasswd(user.PasswordHash)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
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

func (u *UserController) UpdatePasswordById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "user is not exist",
		})
		return
	}

	password := ctx.PostForm("password")
	if password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "password is empty",
		})
		return
	}

	user.PasswordHash, err = encode.EncodePasswd(password)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) UpdateUserNameById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "user is not exist",
		})
		return
	}

	userName := ctx.PostForm("user_name")
	if userName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "user_name is empty",
		})
		return
	}

	user.Username = userName

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) UpdateRoleById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "user is not exist",
		})
		return
	}

	_roleId := ctx.PostForm("role_id")
	if _roleId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "role_id is empty",
		})
		return
	}

	roleId, err := strconv.ParseInt(_roleId, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	user.RoleId = roleId

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": cnt,
	})
}

func (u *UserController) VerifyPassword(ctx *gin.Context) {

	username := ctx.PostForm("username")
	if username == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "username is empty",
		})
		return
	}
	user, err := u.dao.SelectByUserName(username)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "username is not exist",
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}

	password := ctx.PostForm("password")
	if password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "password is empty",
		})
		return
	}
	hash, err := encode.EncodePasswd(password)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": err.Error(),
		})
		return
	}
	if user.PasswordHash != hash {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"message": "wrong password",
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

func (u *UserController) RegisterRouter(r *gin.RouterGroup) {
	r.GET("/users/selectAll", u.SelectAll)
	r.GET("/users/selectById", u.SelectById)
	r.GET("/users/selectByUserName", u.SelectByUserName)
	r.GET("/users/deleteById", u.DeleteById)
	r.POST("/users/insert", u.Insert)
	r.POST("/users/UpdatePasswordById", u.UpdatePasswordById)
	r.POST("/users/UpdateUserNameById", u.UpdateUserNameById)
	r.POST("/users/UpdateRoleById", u.UpdateRoleById)
}
