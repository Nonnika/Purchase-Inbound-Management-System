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
	"github.com/nonnika/pims/internal/middleware"
)

// RoleController 用于处理 Roles 表相关的请求
type RoleController struct {
	dao *dao.RoleDao
}

type roleRequest struct {
	Name        string `json:"name" form:"name"`
	Code        string `json:"code" form:"code"`
	Description string `json:"description" form:"description"`
}

func NewRoleController(dao *dao.RoleDao) *RoleController {
	return &RoleController{dao: dao}
}

func (r *RoleController) SelectAll(ctx *gin.Context) {
	rows, err := r.dao.SelectAll()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, rows)
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

func (r *RoleController) DeleteById(ctx *gin.Context) {
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

	affect, err := r.dao.DeleteRole(id)
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

func (r *RoleController) Insert(ctx *gin.Context) {
	var req roleRequest
	if !bindRoleRequest(ctx, &req) {
		return
	}

	if req.Name == "" || req.Code == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid field",
		})
		return
	}

	role := model.Role{Name: req.Name, Code: req.Code, Description: req.Description}
	insert, err := r.dao.Insert(&role)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id": insert,
	})
}

func (r *RoleController) UpdateNameById(ctx *gin.Context) {
	role, ok := r.roleByQueryId(ctx)
	if !ok {
		return
	}

	var req roleRequest
	if !bindRoleRequest(ctx, &req) {
		return
	}

	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is empty",
		})
		return
	}

	role.Name = req.Name
	r.update(ctx, role)
}

func (r *RoleController) UpdateCodeById(ctx *gin.Context) {
	role, ok := r.roleByQueryId(ctx)
	if !ok {
		return
	}

	var req roleRequest
	if !bindRoleRequest(ctx, &req) {
		return
	}

	if req.Code == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "code is empty",
		})
		return
	}

	role.Code = req.Code
	r.update(ctx, role)
}

func (r *RoleController) UpdateDescriptionById(ctx *gin.Context) {
	role, ok := r.roleByQueryId(ctx)
	if !ok {
		return
	}

	var req roleRequest
	if !bindRoleRequest(ctx, &req) {
		return
	}

	role.Description = req.Description
	r.update(ctx, role)
}

func bindRoleRequest(ctx *gin.Context, req *roleRequest) bool {
	if err := ctx.ShouldBind(req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return false
	}

	return true
}

func (r *RoleController) roleByQueryId(ctx *gin.Context) (*model.Role, bool) {
	_id := ctx.Query("id")
	if _id == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "id is empty",
		})
		return nil, false
	}

	id, err := strconv.ParseInt(_id, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return nil, false
	}

	role, err := r.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "role is not exist",
		})
		return nil, false
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return nil, false
	}

	return role, true
}

func (r *RoleController) update(ctx *gin.Context, role *model.Role) {
	cnt, err := r.dao.Update(role)
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

func (r *RoleController) RegisterAuthRouter(router *gin.RouterGroup) {
	router.GET("/roles/selectAll", r.SelectAll)
	router.GET("/roles/selectById", r.SelectById)
	router.GET("/roles/selectByName", r.SelectByName)
	router.GET("/roles/selectByCode", r.SelectByCode)
	router.POST("/roles/register", middleware.Role(1), r.Insert)
	router.DELETE("/roles/deleteById", middleware.Role(1), r.DeleteById)
	router.POST("/roles/UpdateNameById", middleware.Role(1), r.UpdateNameById)
	router.POST("/roles/UpdateCodeById", middleware.Role(1), r.UpdateCodeById)
	router.POST("/roles/UpdateDescriptionById", middleware.Role(1), r.UpdateDescriptionById)
}
