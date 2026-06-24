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

// ItemCategoriesController 物品分类相关参数处理
type ItemCategoriesController struct {
	dao *dao.ItemCategoriesDao
}

type itemCategoryRequest struct {
	Name        string  `json:"name" form:"name"`
	Description *string `json:"description" form:"description"`
	Parent      *int64  `json:"parent" form:"parent"`
}

func NewItemCategoriesController(dao *dao.ItemCategoriesDao) *ItemCategoriesController {
	return &ItemCategoriesController{dao: dao}
}

func (c *ItemCategoriesController) SelectAll(ctx *gin.Context) {
	var req pageRequest
	if !bindPageRequest(ctx, &req) {
		return
	}

	rows, total, err := c.dao.SelectPage(req.Page, req.PageSize)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	respondPage(ctx, rows, total)
}

func (c *ItemCategoriesController) SelectById(ctx *gin.Context) {
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

	row, err := c.dao.SelectById(id)
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

func (c *ItemCategoriesController) SelectByName(ctx *gin.Context) {
	name := ctx.Query("name")
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is required",
		})
		return
	}

	row, err := c.dao.SelectByName(name)
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

func (c *ItemCategoriesController) DeleteById(ctx *gin.Context) {
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

	affect, err := c.dao.DeleteCategory(id)
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

func (c *ItemCategoriesController) Insert(ctx *gin.Context) {
	var req itemCategoryRequest
	if !bindItemCategoryRequest(ctx, &req) {
		return
	}

	parent := normalizeItemCategoryParent(req.Parent)
	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid field",
		})
		return
	}

	category := model.ItemCategories{Name: req.Name, Description: normalizeItemCategoryDescription(req.Description), Parent: parent}
	insert, err := c.dao.Insert(&category)
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

func (c *ItemCategoriesController) UpdateNameById(ctx *gin.Context) {
	category, ok := c.itemCategoryByQueryId(ctx)
	if !ok {
		return
	}

	var req itemCategoryRequest
	if !bindItemCategoryRequest(ctx, &req) {
		return
	}

	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is empty",
		})
		return
	}

	category.Name = req.Name
	c.update(ctx, category)
}

func (c *ItemCategoriesController) UpdateDescriptionById(ctx *gin.Context) {
	category, ok := c.itemCategoryByQueryId(ctx)
	if !ok {
		return
	}

	var req itemCategoryRequest
	if !bindItemCategoryRequest(ctx, &req) {
		return
	}

	category.Description = normalizeItemCategoryDescription(req.Description)
	c.update(ctx, category)
}

func (c *ItemCategoriesController) UpdateParentById(ctx *gin.Context) {
	category, ok := c.itemCategoryByQueryId(ctx)
	if !ok {
		return
	}

	var req itemCategoryRequest
	if !bindItemCategoryRequest(ctx, &req) {
		return
	}

	category.Parent = normalizeItemCategoryParent(req.Parent)
	c.update(ctx, category)
}

func bindItemCategoryRequest(ctx *gin.Context, req *itemCategoryRequest) bool {
	if err := ctx.ShouldBind(req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return false
	}

	return true
}

func normalizeItemCategoryParent(parent *int64) *int64 {
	if parent == nil || *parent == 0 {
		return nil
	}

	return parent
}

func normalizeItemCategoryDescription(description *string) *string {
	if description == nil || *description == "" {
		return nil
	}

	return description
}

func (c *ItemCategoriesController) itemCategoryByQueryId(ctx *gin.Context) (*model.ItemCategories, bool) {
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

	category, err := c.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "category is not exist",
		})
		return nil, false
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return nil, false
	}

	return category, true
}

func (c *ItemCategoriesController) update(ctx *gin.Context, category *model.ItemCategories) {
	cnt, err := c.dao.Update(category)
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
func (c *ItemCategoriesController) RegisterRouter(r *gin.RouterGroup) {

}

func (c *ItemCategoriesController) RegisterAuthRouter(r *gin.RouterGroup) {
	admin := middleware.Role(model.RoleAdmin)

	r.POST("/itemCategories/register", admin, c.Insert)
	r.POST("/itemCategories/selectAll", c.SelectAll)
	r.GET("/itemCategories/selectById", c.SelectById)
	r.GET("/itemCategories/selectByName", c.SelectByName)
	r.DELETE("/itemCategories/deleteById", admin, c.DeleteById)
	r.POST("/itemCategories/UpdateNameById", admin, c.UpdateNameById)
	r.POST("/itemCategories/UpdateDescriptionById", admin, c.UpdateDescriptionById)
	r.POST("/itemCategories/UpdateParentById", admin, c.UpdateParentById)
}
