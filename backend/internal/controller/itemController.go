package controller

import (
	"database/sql"
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/middleware"
)

// ItemController 物品相关请求
type ItemController struct {
	dao *dao.ItemDao
}

type createItemRequest struct {
	Name            string   `json:"name" form:"name"`
	CategoryId      *int64   `json:"category_id" form:"category_id"`
	Price           *float64 `json:"price" form:"price"`
	ItemInventory   *int64   `json:"item_inventory" form:"item_inventory"`
	FrozenInventory *int64   `json:"frozen_inventory" form:"frozen_inventory"`
	WarehouseId     *int64   `json:"warehouse_id" form:"warehouse_id"`
	WarningLevel    *int64   `json:"warning_level" form:"warning_level"`
}

func NewItemController(dao *dao.ItemDao) *ItemController {
	return &ItemController{dao: dao}
}

func (i *ItemController) SelectAll(ctx *gin.Context) {
	items, err := i.dao.SelectAll()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, items)
}

func (i *ItemController) SelectById(ctx *gin.Context) {
	id, ok := parseInt64Query(ctx, "id")
	if !ok {
		return
	}

	item, err := i.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "item is not exist",
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, item)
}

func (i *ItemController) Create(ctx *gin.Context) {
	var req createItemRequest
	if err := ctx.ShouldBind(&req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}
	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is required",
		})
		return
	}
	if req.ItemInventory != nil && *req.ItemInventory < 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "item_inventory must be greater than or equal to 0",
		})
		return
	}
	if req.FrozenInventory != nil && *req.FrozenInventory < 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "frozen_inventory must be greater than or equal to 0",
		})
		return
	}
	if req.ItemInventory != nil && req.FrozenInventory != nil && *req.FrozenInventory > *req.ItemInventory {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "frozen_inventory must be less than or equal to item_inventory",
		})
		return
	}

	item := model.Item{
		Name:            req.Name,
		CategoryId:      normalizeOptionalInt64(req.CategoryId),
		Price:           req.Price,
		ItemInventory:   req.ItemInventory,
		FrozenInventory: req.FrozenInventory,
		WarehouseId:     normalizeOptionalInt64(req.WarehouseId),
		WarningLevel:    req.WarningLevel,
	}

	id, err := i.dao.Insert(&item)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id": id,
	})
}

func (i *ItemController) RegisterAuthRouter(r *gin.RouterGroup) {
	purchaser := middleware.Role(model.RoleAdmin, model.RolePurchaser)

	r.GET("/items/selectAll", i.SelectAll)
	r.GET("/items/selectById", i.SelectById)
	r.POST("/items/create", purchaser, i.Create)
}

func normalizeOptionalInt64(value *int64) *int64 {
	if value == nil || *value == 0 {
		return nil
	}
	return value
}
