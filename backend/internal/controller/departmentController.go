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

// DepartmentController 部门相关参数处理
type DepartmentController struct {
	dao *dao.DepartmentDao
}

type departmentRequest struct {
	Name        string  `json:"name" form:"name"`
	Description *string `json:"description" form:"description"`
	Parent      *int64  `json:"parent" form:"parent"`
}

func NewDepartmentController(dao *dao.DepartmentDao) *DepartmentController {
	return &DepartmentController{dao: dao}
}

func (d *DepartmentController) SelectAll(ctx *gin.Context) {
	var req pageRequest
	if !bindPageRequest(ctx, &req) {
		return
	}

	rows, total, err := d.dao.SelectPage(req.Page, req.PageSize)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	respondPage(ctx, rows, total)
}

func (d *DepartmentController) SelectById(ctx *gin.Context) {
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

	row, err := d.dao.SelectById(id)
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

func (d *DepartmentController) SelectByName(ctx *gin.Context) {
	name := ctx.Query("name")
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is required",
		})
		return
	}

	row, err := d.dao.SelectByName(name)
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

func (d *DepartmentController) DeleteById(ctx *gin.Context) {
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

	affect, err := d.dao.DeleteDepartment(id)
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

func (d *DepartmentController) Insert(ctx *gin.Context) {
	var req departmentRequest
	if !bindDepartmentRequest(ctx, &req) {
		return
	}

	parent := normalizeDepartmentParent(req.Parent)
	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid field",
		})
		return
	}

	department := model.Department{Name: req.Name, Description: normalizeDepartmentDescription(req.Description), Parent: parent}
	insert, err := d.dao.Insert(&department)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id": insert,
	})
}

func (d *DepartmentController) UpdateNameById(ctx *gin.Context) {
	department, ok := d.departmentByQueryId(ctx)
	if !ok {
		return
	}

	var req departmentRequest
	if !bindDepartmentRequest(ctx, &req) {
		return
	}

	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is empty",
		})
		return
	}

	department.Name = req.Name
	d.update(ctx, department)
}

func (d *DepartmentController) UpdateDescriptionById(ctx *gin.Context) {
	department, ok := d.departmentByQueryId(ctx)
	if !ok {
		return
	}

	var req departmentRequest
	if !bindDepartmentRequest(ctx, &req) {
		return
	}

	department.Description = normalizeDepartmentDescription(req.Description)
	d.update(ctx, department)
}

func (d *DepartmentController) UpdateParentById(ctx *gin.Context) {
	department, ok := d.departmentByQueryId(ctx)
	if !ok {
		return
	}

	var req departmentRequest
	if !bindDepartmentRequest(ctx, &req) {
		return
	}

	department.Parent = normalizeDepartmentParent(req.Parent)
	d.update(ctx, department)
}

func bindDepartmentRequest(ctx *gin.Context, req *departmentRequest) bool {
	if err := ctx.ShouldBind(req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return false
	}

	return true
}

func normalizeDepartmentParent(parent *int64) *int64 {
	if parent == nil || *parent == 0 {
		return nil
	}

	return parent
}

func normalizeDepartmentDescription(description *string) *string {
	if description == nil || *description == "" {
		return nil
	}

	return description
}

func (d *DepartmentController) departmentByQueryId(ctx *gin.Context) (*model.Department, bool) {
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

	department, err := d.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "department is not exist",
		})
		return nil, false
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return nil, false
	}

	return department, true
}

func (d *DepartmentController) update(ctx *gin.Context, department *model.Department) {
	cnt, err := d.dao.Update(department)
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

// RegisterRouter 为以后预留
func (d *DepartmentController) RegisterRouter(r *gin.RouterGroup) {

}

func (d *DepartmentController) RegisterAuthRouter(r *gin.RouterGroup) {
	admin := middleware.Role(model.RoleAdmin)

	r.POST("/departments/register", admin, d.Insert)
	r.POST("/departments/selectAll", d.SelectAll)
	r.GET("/departments/selectById", d.SelectById)
	r.GET("/departments/selectByName", d.SelectByName)
	r.DELETE("/departments/deleteById", admin, d.DeleteById)
	r.POST("/departments/UpdateNameById", admin, d.UpdateNameById)
	r.POST("/departments/UpdateDescriptionById", admin, d.UpdateDescriptionById)
	r.POST("/departments/UpdateParentById", admin, d.UpdateParentById)
}
