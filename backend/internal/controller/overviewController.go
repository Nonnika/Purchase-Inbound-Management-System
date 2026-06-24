package controller

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nonnika/pims/internal/database/dao"
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

func (o *OverviewController) RegisterAuthRouter(r *gin.RouterGroup) {
	r.GET("/overview/summary", o.Summary)
}
