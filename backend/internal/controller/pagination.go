package controller

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

const (
	defaultPageSize int64 = 10
	maxPageSize     int64 = 100
)

// pageRequest 分页请求参数
type pageRequest struct {
	Page     int64 `json:"page" form:"page"`
	PageSize int64 `json:"page_size" form:"page_size"`
}

// pageResult 分页返回结构
type pageResult struct {
	List  any   `json:"list"`
	Total int64 `json:"total"`
}

// bindPageRequest 绑定并校验分页参数，失败时已写入响应并返回 false
func bindPageRequest(ctx *gin.Context, req *pageRequest) bool {
	if err := ctx.ShouldBind(req); err != nil {
		log.Println(err)
		ctx.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return false
	}

	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = defaultPageSize
	}
	if req.PageSize > maxPageSize {
		req.PageSize = maxPageSize
	}

	return true
}

// respondPage 写入分页响应
func respondPage(ctx *gin.Context, list any, total int64) {
	ctx.JSON(http.StatusOK, pageResult{
		List:  list,
		Total: total,
	})
}
