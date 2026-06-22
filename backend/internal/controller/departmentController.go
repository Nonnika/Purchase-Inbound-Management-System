package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
)

type DepartmentController struct {
	dao *dao.DepartmentDao
}

func NewDepartmentController(dao *dao.DepartmentDao) *DepartmentController {
	return &DepartmentController{dao: dao}
}

func (d *DepartmentController) Insert(ctx *gin.Context) {
	name := ctx.PostForm("name")
	description := ctx.PostForm("description")
	parent := ctx.PostForm("parent")

	if name == "" || description == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid field",
		})
		return
	}
	pId, err := strconv.Atoi(parent)
	if err != nil && parent != "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "not a number",
		})
		return
	}

	department := model.Department{Name: name, Description: description, Parent: int64(pId)}
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

func (d *DepartmentController) RegisterRouter(r *gin.RouterGroup) {
	r.POST("/register", d.Insert)
}
