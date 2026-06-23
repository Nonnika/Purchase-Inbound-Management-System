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

// WarehouseController 仓库相关参数处理
type WarehouseController struct {
	dao *dao.WarehouseDao
}

type warehouseRequest struct {
	Name        string  `json:"name" form:"name"`
	Description *string `json:"description" form:"description"`
}

func NewWarehouseController(dao *dao.WarehouseDao) *WarehouseController {
	return &WarehouseController{dao: dao}
}

func (w *WarehouseController) SelectAll(ctx *gin.Context) {
	rows, err := w.dao.SelectAll()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, rows)
}

func (w *WarehouseController) SelectById(ctx *gin.Context) {
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

	row, err := w.dao.SelectById(id)
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

func (w *WarehouseController) SelectByName(ctx *gin.Context) {
	name := ctx.Query("name")
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is required",
		})
		return
	}

	row, err := w.dao.SelectByName(name)
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

func (w *WarehouseController) DeleteById(ctx *gin.Context) {
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

	affect, err := w.dao.DeleteWarehouse(id)
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

func (w *WarehouseController) Insert(ctx *gin.Context) {
	var req warehouseRequest
	if !bindWarehouseRequest(ctx, &req) {
		return
	}

	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid field",
		})
		return
	}

	warehouse := model.Warehouse{Name: req.Name, Description: normalizeWarehouseDescription(req.Description)}
	insert, err := w.dao.Insert(&warehouse)
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

func (w *WarehouseController) UpdateNameById(ctx *gin.Context) {
	warehouse, ok := w.warehouseByQueryId(ctx)
	if !ok {
		return
	}

	var req warehouseRequest
	if !bindWarehouseRequest(ctx, &req) {
		return
	}

	if req.Name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "name is empty",
		})
		return
	}

	warehouse.Name = req.Name
	w.update(ctx, warehouse)
}

func (w *WarehouseController) UpdateDescriptionById(ctx *gin.Context) {
	warehouse, ok := w.warehouseByQueryId(ctx)
	if !ok {
		return
	}

	var req warehouseRequest
	if !bindWarehouseRequest(ctx, &req) {
		return
	}

	warehouse.Description = normalizeWarehouseDescription(req.Description)
	w.update(ctx, warehouse)
}

func bindWarehouseRequest(ctx *gin.Context, req *warehouseRequest) bool {
	if err := ctx.ShouldBind(req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return false
	}

	return true
}

func normalizeWarehouseDescription(description *string) *string {
	if description == nil || *description == "" {
		return nil
	}

	return description
}

func (w *WarehouseController) warehouseByQueryId(ctx *gin.Context) (*model.Warehouse, bool) {
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

	warehouse, err := w.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "warehouse is not exist",
		})
		return nil, false
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return nil, false
	}

	return warehouse, true
}

func (w *WarehouseController) update(ctx *gin.Context, warehouse *model.Warehouse) {
	cnt, err := w.dao.Update(warehouse)
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
func (w *WarehouseController) RegisterRouter(r *gin.RouterGroup) {

}

func (w *WarehouseController) RegisterAuthRouter(r *gin.RouterGroup) {
	admin := middleware.Role(model.RoleAdmin)

	r.POST("/warehouses/register", admin, w.Insert)
	r.GET("/warehouses/selectAll", w.SelectAll)
	r.GET("/warehouses/selectById", w.SelectById)
	r.GET("/warehouses/selectByName", w.SelectByName)
	r.DELETE("/warehouses/deleteById", admin, w.DeleteById)
	r.POST("/warehouses/UpdateNameById", admin, w.UpdateNameById)
	r.POST("/warehouses/UpdateDescriptionById", admin, w.UpdateDescriptionById)
}
