package controller

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
)

const (
	defaultOrderTrendDays = 14
	maxOrderTrendDays     = 90
)

// OverviewController HomePage 概览相关请求
type OverviewController struct {
	dao *dao.OverviewDao
}

func NewOverviewController(dao *dao.OverviewDao) *OverviewController {
	return &OverviewController{dao: dao}
}

func (o *OverviewController) Summary(ctx *gin.Context) {
	summary, err := o.dao.Summary()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, summary)
}

func (o *OverviewController) OrderTrend(ctx *gin.Context) {
	days := defaultOrderTrendDays
	if value := ctx.Query("days"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"error": "days must be an integer",
			})
			return
		}
		days = parsed
	}
	if days < 1 || days > maxOrderTrendDays {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": "days must be between 1 and 90",
		})
		return
	}

	trend, err := o.dao.OrderTrend(days)
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, trend)
}

func (o *OverviewController) CargoByWarehouse(ctx *gin.Context) {
	cargo, err := o.dao.CargoByWarehouse()
	if err != nil {
		log.Println(err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, cargo)
}

func (o *OverviewController) RegisterAuthRouter(r *gin.RouterGroup) {
	r.GET("/overview/summary", o.Summary)
	r.GET("/overview/orderTrend", o.OrderTrend)
	r.GET("/overview/cargoByWarehouse", o.CargoByWarehouse)
}
