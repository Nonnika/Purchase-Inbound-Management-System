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
	"github.com/nonnika/pims/internal/jwt"
	"github.com/nonnika/pims/internal/middleware"
)

// UserController 用于处理 Users 表相关的请求
type UserController struct {
	dao    *dao.UserDao
	jwtMgr *jwt.JManager
}

type registerUserRequest struct {
	Username     string `json:"username" form:"username"`
	Password     string `json:"password" form:"password"`
	RealName     string `json:"real_name" form:"real_name"`
	Phone        string `json:"phone" form:"phone"`
	RoleId       int64  `json:"role_id" form:"role_id"`
	DepartmentId int64  `json:"department_id" form:"department_id"`
}

func NewUserController(dao *dao.UserDao, jwtMgr *jwt.JManager) *UserController {
	return &UserController{dao: dao, jwtMgr: jwtMgr}
}

func (u *UserController) SelectAll(ctx *gin.Context) {
	rows, err := u.dao.SelectAll()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
	}

	ctx.JSON(http.StatusOK, rows)

}

func (u *UserController) SelectById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is required",
		})
		return
	}
	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	row, err := u.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, row)
}

func (u *UserController) SelectByUserName(ctx *gin.Context) {
	_userName := ctx.Query("user_name")
	if _userName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user_name is required",
		})
		return
	}

	row, err := u.dao.SelectByUserName(_userName)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": err.Error(),
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
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
			"error": err.Error(),
		})
		return
	}

	affect, err := u.dao.DeleteUser(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"affected": affect,
	})
}

func (u *UserController) Register(ctx *gin.Context) {
	var req registerUserRequest
	err := ctx.ShouldBind(&req)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}
	if req.Username == "" {
		log.Println("username is empty")
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "username is empty",
		})
		return
	}
	if req.Password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "password is empty",
		})
		return
	}

	passwordHash, err := encode.EncodePasswd(req.Password)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user := model.User{
		Username:     req.Username,
		PasswordHash: passwordHash,
		RealName:     req.RealName,
		Phone:        req.Phone,
		RoleId:       req.RoleId,
		DepartmentId: req.DepartmentId,
	}
	exec, err := u.dao.Insert(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
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
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	password := ctx.PostForm("password")
	if password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "password is empty",
		})
		return
	}

	user.PasswordHash, err = encode.EncodePasswd(password)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
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
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	userName := ctx.PostForm("user_name")
	if userName == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user_name is empty",
		})
		return
	}

	user.Username = userName

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
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
			"error": "id is empty",
		})
		return
	}

	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user, err := u.dao.SelectById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "user is not exist",
		})
		return
	}

	_roleId := ctx.PostForm("role_id")
	if _roleId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "role_id is empty",
		})
		return
	}

	roleId, err := strconv.ParseInt(_roleId, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	user.RoleId = roleId

	cnt, err := u.dao.Update(user)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
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
			"error": "username is empty",
		})
		return
	}
	user, err := u.dao.SelectByUserName(username)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "username is not exist",
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	password := ctx.PostForm("password")
	if password == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error":  "password is empty",
			"isTrue": false,
		})
		return
	}

	if !encode.CompareHashAndPassword(user.PasswordHash, password) {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"error":  "wrong password",
			"isTrue": false,
		})
		return
	}

	token, err := u.jwtMgr.GenerateToken(user.Id, user.Username, user.RoleId)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate jwt token",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"user":   user,
		"isTrue": true,
		"token":  token,
	})

}

func (u *UserController) RegisterRouter(r *gin.RouterGroup) {
	r.POST("/users/register", u.Register)
	r.POST("/users/verify", u.VerifyPassword)
}
func (u *UserController) RegisterAuthRouter(r *gin.RouterGroup) {
	r.GET("/users/selectAll", u.SelectAll)
	r.GET("/users/selectById", u.SelectById)
	r.GET("/users/selectByUserName", u.SelectByUserName)
	r.DELETE("/users/deleteById", middleware.Role(1), u.DeleteById)
	r.POST("/users/UpdatePasswordById", u.UpdatePasswordById)
	r.POST("/users/UpdateUserNameById", u.UpdateUserNameById)
	r.POST("/users/UpdateRoleById", u.UpdateRoleById)
}
