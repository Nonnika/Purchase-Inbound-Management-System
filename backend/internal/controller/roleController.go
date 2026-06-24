package controller

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
)

// RoleController 用于处理 Roles 表相关的请求
type RoleController struct {
	dao *dao.RoleDao
}

func NewRoleController(dao *dao.RoleDao) *RoleController {
	return &RoleController{dao: dao}
}

func (r *RoleController) SelectAll(ctx *gin.Context) {
	var req pageRequest
	if !bindPageRequest(ctx, &req) {
		return
	}

	rows, total, err := r.dao.SelectPage(req.Page, req.PageSize)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	respondPage(ctx, rows, total)
}

func (r *RoleController) SelectById(ctx *gin.Context) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is required",
		})
		return
	}

	id, err := strconv.ParseInt(_id, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	row, err := r.dao.SelectById(id)
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

func (r *RoleController) SelectByName(ctx *gin.Context) {
	name := ctx.Query("name")
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is required",
		})
		return
	}

	row, err := r.dao.SelectByName(name)
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

func (r *RoleController) SelectByCode(ctx *gin.Context) {
	code := ctx.Query("code")
	if code == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "code is required",
		})
		return
	}

	row, err := r.dao.SelectByCode(code)
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

func (r *RoleController) RegisterAuthRouter(router *gin.RouterGroup) {
	router.POST("/roles/selectAll", r.SelectAll)
	router.GET("/roles/selectById", r.SelectById)
	router.GET("/roles/selectByName", r.SelectByName)
	router.GET("/roles/selectByCode", r.SelectByCode)
}
