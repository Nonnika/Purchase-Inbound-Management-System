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

type updateItemRequest struct {
	Name            *string  `json:"name" form:"name"`
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
	var req pageRequest
	if !bindPageRequest(ctx, &req) {
		return
	}

	items, total, err := i.dao.SelectPage(req.Page, req.PageSize)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	respondPage(ctx, items, total)
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

func (i *ItemController) Update(ctx *gin.Context) {
	id, ok := parseInt64Query(ctx, "id")
	if !ok {
		return
	}

	current, err := i.dao.SelectById(id)
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

	var req updateItemRequest
	if err := ctx.ShouldBind(&req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if req.Name != nil {
		current.Name = *req.Name
	}
	if req.CategoryId != nil {
		current.CategoryId = normalizeOptionalInt64(req.CategoryId)
	}
	if req.Price != nil {
		current.Price = req.Price
	}
	if req.ItemInventory != nil {
		if *req.ItemInventory < 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"error": "item_inventory must be greater than or equal to 0",
			})
			return
		}
		current.ItemInventory = req.ItemInventory
	}
	if req.FrozenInventory != nil {
		if *req.FrozenInventory < 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"error": "frozen_inventory must be greater than or equal to 0",
			})
			return
		}
		current.FrozenInventory = req.FrozenInventory
	}
	if req.WarehouseId != nil {
		current.WarehouseId = normalizeOptionalInt64(req.WarehouseId)
	}
	if req.WarningLevel != nil {
		current.WarningLevel = req.WarningLevel
	}
	if current.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is required",
		})
		return
	}
	if current.ItemInventory != nil && current.FrozenInventory != nil && *current.FrozenInventory > *current.ItemInventory {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "frozen_inventory must be less than or equal to item_inventory",
		})
		return
	}

	affected, err := i.dao.Update(current)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"affected": affected,
	})
}

func (i *ItemController) Delete(ctx *gin.Context) {
	id, ok := parseInt64Query(ctx, "id")
	if !ok {
		return
	}

	affected, err := i.dao.DeleteById(id)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	if affected == 0 {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "item is not exist",
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"affected": affected,
	})
}

func (i *ItemController) CalSum(ctx *gin.Context) {
	_id := ctx.Query("id")
	id, err := strconv.Atoi(_id)
	if err != nil {
		log.Printf("Error from CalSum : %s \n", err.Error())
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "bad number",
		})
		return
	}
	items, err := i.dao.SelectPricesAndInventory(int64(id))
	if err != nil {
		log.Println("Error from CalSum : ", err.Error())
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "server internal error",
		})
		return
	}
	var sum float64 = 0
	for _, val := range items {
		if val.Price != nil && val.ItemInventory != nil {
			sum += *val.Price * float64(*val.ItemInventory)
		}
	}
	ctx.JSON(
		http.StatusOK, gin.H{
			"sum": sum,
		},
	)
	return
}

func (i *ItemController) RegisterAuthRouter(r *gin.RouterGroup) {
	purchaser := middleware.Role(model.RoleAdmin, model.RolePurchaser)
	manager := middleware.Role(model.RoleAdmin, model.RoleWarehouse)

	r.POST("/items/selectAll", i.SelectAll)
	r.GET("/items/selectById", i.SelectById)
	r.POST("/items/create", purchaser, i.Create)
	r.POST("/items/update", manager, i.Update)
	r.DELETE("/items/delete", manager, i.Delete)
	r.GET("/items/CalSum", i.CalSum)
}

func normalizeOptionalInt64(value *int64) *int64 {
	if value == nil || *value == 0 {
		return nil
	}
	return value
}
