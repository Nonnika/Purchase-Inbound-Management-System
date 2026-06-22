package controller

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
	"github.com/nonnika/pims/internal/database/model"
	"github.com/nonnika/pims/internal/middleware"
)

// OrderController 订单和订单事件哈希链相关请求
type OrderController struct {
	dao *dao.OrderDao
}

type createOrderRequest struct {
	ItemId       int64           `json:"item_id" form:"item_id"`
	UserId       int64           `json:"user_id" form:"user_id"`
	Count        int64           `json:"count" form:"count"`
	EventPayload json.RawMessage `json:"event_payload"`
}

type appendOrderEventRequest struct {
	OrderId      int64           `json:"order_id" form:"order_id"`
	EventPayload json.RawMessage `json:"event_payload"`
}

func NewOrderController(dao *dao.OrderDao) *OrderController {
	return &OrderController{dao: dao}
}

func (o *OrderController) SelectAll(ctx *gin.Context) {
	orders, err := o.dao.SelectAll()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, orders)
}

func (o *OrderController) SelectById(ctx *gin.Context) {
	id, ok := parseInt64Query(ctx, "id")
	if !ok {
		return
	}

	order, err := o.dao.SelectById(id)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "order is not exist",
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	if !canAccessOrder(ctx, order) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "permission denied",
		})
		return
	}

	ctx.JSON(http.StatusOK, order)
}

func (o *OrderController) SelectByUserId(ctx *gin.Context) {
	userId, ok := parseInt64Query(ctx, "user_id")
	if !ok {
		return
	}
	if !canViewAnyOrder(ctx) && userId != currentUserId(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "permission denied",
		})
		return
	}

	orders, err := o.dao.SelectByUserId(userId)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, orders)
}

func (o *OrderController) CreatePurchaseRequest(ctx *gin.Context) {
	o.createTypedOrder(ctx, dao.OrderTypePurchase)
}

func (o *OrderController) CreateOutboundRequest(ctx *gin.Context) {
	o.createTypedOrder(ctx, dao.OrderTypeOutbound)
}

func (o *OrderController) createTypedOrder(ctx *gin.Context, orderType string) {
	var req createOrderRequest
	if err := ctx.ShouldBind(&req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}
	if req.UserId == 0 {
		req.UserId = currentUserId(ctx)
	}
	if !isAdmin(ctx) && req.UserId != currentUserId(ctx) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "permission denied",
		})
		return
	}
	if req.ItemId <= 0 || req.UserId <= 0 || req.Count <= 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "item_id, user_id and count are required",
		})
		return
	}

	order := model.Order{
		ItemId:    req.ItemId,
		UserId:    req.UserId,
		Count:     req.Count,
		OrderType: orderType,
	}
	operatorUserId := currentUserIdPtr(ctx)
	event, err := o.dao.Create(&order, operatorUserId, req.EventPayload)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"order_id": order.Id,
		"event":    event,
	})
}

func (o *OrderController) AuditApprove(ctx *gin.Context) {
	o.appendStep(ctx, dao.OrderStepAuditApproved)
}

func (o *OrderController) AuditReject(ctx *gin.Context) {
	o.appendStep(ctx, dao.OrderStepAuditRejected)
}

func (o *OrderController) WarehouseReceive(ctx *gin.Context) {
	o.appendStep(ctx, dao.OrderStepWarehouseReceived)
}

func (o *OrderController) WarehouseShip(ctx *gin.Context) {
	o.appendStep(ctx, dao.OrderStepWarehouseShipped)
}

func (o *OrderController) appendStep(ctx *gin.Context, step string) {
	var req appendOrderEventRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}
	if req.OrderId <= 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "order_id is required",
		})
		return
	}
	order, err := o.dao.SelectById(req.OrderId)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "order is not exist",
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}
	if !canAccessOrder(ctx, order) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "permission denied",
		})
		return
	}

	event, err := o.dao.AppendEvent(req.OrderId, step, currentUserIdPtr(ctx), req.EventPayload)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "order is not exist",
		})
		return
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, event)
}

func (o *OrderController) SelectEventsByOrderId(ctx *gin.Context) {
	orderId, ok := parseInt64Query(ctx, "order_id")
	if !ok {
		return
	}
	if !o.canAccessOrderById(ctx, orderId) {
		return
	}

	events, err := o.dao.SelectEventsByOrderId(orderId)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, events)
}

func (o *OrderController) VerifyChain(ctx *gin.Context) {
	orderId, ok := parseInt64Query(ctx, "order_id")
	if !ok {
		return
	}
	if !o.canAccessOrderById(ctx, orderId) {
		return
	}

	result, err := o.dao.VerifyChain(orderId)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (o *OrderController) RegisterAuthRouter(r *gin.RouterGroup) {
	orderViewer := middleware.Role(model.RoleAdmin, model.RoleAuditor, model.RoleWarehouse)
	purchaser := middleware.Role(model.RoleAdmin, model.RolePurchaser)
	applicant := middleware.Role(model.RoleAdmin, model.RoleApplicant)
	auditor := middleware.Role(model.RoleAdmin, model.RoleAuditor)
	warehouse := middleware.Role(model.RoleAdmin, model.RoleWarehouse)

	r.POST("/orders/purchaseRequests", purchaser, o.CreatePurchaseRequest)
	r.POST("/orders/outboundRequests", applicant, o.CreateOutboundRequest)
	r.POST("/orders/auditApprove", auditor, o.AuditApprove)
	r.POST("/orders/auditReject", auditor, o.AuditReject)
	r.POST("/orders/warehouseReceive", warehouse, o.WarehouseReceive)
	r.POST("/orders/warehouseShip", warehouse, o.WarehouseShip)
	r.GET("/orders/selectAll", orderViewer, o.SelectAll)
	r.GET("/orders/selectById", o.SelectById)
	r.GET("/orders/selectByUserId", o.SelectByUserId)
	r.GET("/orders/events", o.SelectEventsByOrderId)
	r.GET("/orders/verifyChain", o.VerifyChain)
}

func (o *OrderController) canAccessOrderById(ctx *gin.Context, orderId int64) bool {
	order, err := o.dao.SelectById(orderId)
	if errors.Is(err, sql.ErrNoRows) {
		ctx.JSON(http.StatusNotFound, gin.H{
			"error": "order is not exist",
		})
		return false
	} else if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return false
	}
	if !canAccessOrder(ctx, order) {
		ctx.JSON(http.StatusForbidden, gin.H{
			"error": "permission denied",
		})
		return false
	}
	return true
}

func parseInt64Query(ctx *gin.Context, name string) (int64, bool) {
	value := ctx.Query(name)
	if value == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": name + " is required",
		})
		return 0, false
	}

	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return 0, false
	}

	return id, true
}

func currentUserId(ctx *gin.Context) int64 {
	userId, ok := ctx.Get("user_id")
	if !ok {
		return 0
	}
	id, ok := userId.(int64)
	if !ok {
		return 0
	}
	return id
}

func currentRoleId(ctx *gin.Context) int64 {
	roleId, ok := ctx.Get("roleId")
	if !ok {
		return 0
	}
	role, ok := roleId.(int64)
	if !ok {
		return 0
	}
	return role
}

func isAdmin(ctx *gin.Context) bool {
	return currentRoleId(ctx) == model.RoleAdmin
}

func canViewAnyOrder(ctx *gin.Context) bool {
	roleId := currentRoleId(ctx)
	return roleId == model.RoleAdmin || roleId == model.RoleAuditor || roleId == model.RoleWarehouse
}

func canAccessOrder(ctx *gin.Context, order *model.Order) bool {
	return canViewAnyOrder(ctx) || order.UserId == currentUserId(ctx)
}

func currentUserIdPtr(ctx *gin.Context) *int64 {
	id := currentUserId(ctx)
	if id == 0 {
		return nil
	}
	return &id
}
