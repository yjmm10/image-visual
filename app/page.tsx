"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Upload,
  Download,
  Square,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  X,
  ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Moon,
  Sun,
  Layers,
  Copy,
  Clipboard,
} from "lucide-react"

interface Box {
  x1: number // 左上角X
  y1: number // 左上角Y
  x2: number // 右下角X
  y2: number // 右下角Y
  id: string
  visible: boolean
  color: string
}

interface ViewState {
  scale: number
  offsetX: number
  offsetY: number
}

interface ImageData {
  id: string
  name: string
  image: HTMLImageElement
  boxes: Box[]
  viewState: ViewState
}

type ResizeHandle = "tl" | "tr" | "bl" | "br" | "top" | "right" | "bottom" | "left" | null

export default function ImageMaskApp() {
  const [images, setImages] = useState<ImageData[]>([])
  const [currentImageId, setCurrentImageId] = useState<string | null>(null)
  const [boxInput, setBoxInput] = useState("")
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragType, setDragType] = useState<"canvas" | "box" | "resize" | null>(null)
  const [dragBoxId, setDragBoxId] = useState<string | null>(null)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)

  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [middlePanelWidth, setMiddlePanelWidth] = useState(288)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingMiddle, setIsResizingMiddle] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

  const getCurrentImage = useCallback(() => {
    return images.find((img) => img.id === currentImageId) || null
  }, [images, currentImageId])

  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      const currentImage = getCurrentImage()
      if (!canvas || !currentImage) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      const x = (clientX - rect.left - currentImage.viewState.offsetX) / currentImage.viewState.scale
      const y = (clientY - rect.top - currentImage.viewState.offsetY) / currentImage.viewState.scale
      return { x, y }
    },
    [getCurrentImage],
  )

  const getBoxAtPoint = useCallback(
    (x: number, y: number) => {
      const currentImage = getCurrentImage()
      if (!currentImage) return null

      for (let i = currentImage.boxes.length - 1; i >= 0; i--) {
        const box = currentImage.boxes[i]
        if (box.visible && x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
          return box
        }
      }
      return null
    },
    [getCurrentImage],
  )

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const currentImage = getCurrentImage()
    if (!canvas || !ctx || !currentImage) return

    const container = containerRef.current
    if (container) {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 如果是初始状态（scale=1, offset=0），自动适应画布大小
    if (
      currentImage.viewState.scale === 1 &&
      currentImage.viewState.offsetX === 0 &&
      currentImage.viewState.offsetY === 0
    ) {
      const scaleX = canvas.width / currentImage.image.width
      const scaleY = canvas.height / currentImage.image.height
      const scale = Math.min(scaleX, scaleY, 1) // 不超过原图大小

      const offsetX = (canvas.width - currentImage.image.width * scale) / 2
      const offsetY = (canvas.height - currentImage.image.height * scale) / 2

      // 更新视图状态
      setImages((prev) =>
        prev.map((img) => (img.id === currentImageId ? { ...img, viewState: { scale, offsetX, offsetY } } : img)),
      )
      return
    }

    ctx.save()

    ctx.translate(currentImage.viewState.offsetX, currentImage.viewState.offsetY)
    ctx.scale(currentImage.viewState.scale, currentImage.viewState.scale)

    ctx.drawImage(currentImage.image, 0, 0)

    currentImage.boxes.forEach((box) => {
      if (!box.visible) return

      const width = box.x2 - box.x1
      const height = box.y2 - box.y1

      ctx.strokeStyle = box.color
      ctx.lineWidth = (selectedBoxId === box.id ? 3 : 2) / currentImage.viewState.scale
      ctx.strokeRect(box.x1, box.y1, width, height)

      ctx.fillStyle = box.color + "33"
      ctx.fillRect(box.x1, box.y1, width, height)

      if (selectedBoxId === box.id) {
        const cornerSize = 8 / currentImage.viewState.scale
        const edgeSize = 4 / currentImage.viewState.scale

        ctx.fillStyle = box.color
        // 角点手柄
        ctx.fillRect(box.x1 - cornerSize / 2, box.y1 - cornerSize / 2, cornerSize, cornerSize)
        ctx.fillRect(box.x2 - cornerSize / 2, box.y1 - cornerSize / 2, cornerSize, cornerSize)
        ctx.fillRect(box.x1 - cornerSize / 2, box.y2 - cornerSize / 2, cornerSize, cornerSize)
        ctx.fillRect(box.x2 - cornerSize / 2, box.y2 - cornerSize / 2, cornerSize, cornerSize)

        // 边中点手柄
        const midX = (box.x1 + box.x2) / 2
        const midY = (box.y1 + box.y2) / 2
        ctx.fillRect(midX - edgeSize / 2, box.y1 - edgeSize / 2, edgeSize, edgeSize)
        ctx.fillRect(midX - edgeSize / 2, box.y2 - edgeSize / 2, edgeSize, edgeSize)
        ctx.fillRect(box.x1 - edgeSize / 2, midY - edgeSize / 2, edgeSize, edgeSize)
        ctx.fillRect(box.x2 - edgeSize / 2, midY - edgeSize / 2, edgeSize, edgeSize)
      }
    })

    ctx.restore()
  }, [getCurrentImage, selectedBoxId, currentImageId])

  const handlePanelMouseDown = useCallback((e: React.MouseEvent, panel: "left" | "middle") => {
    e.preventDefault()
    if (panel === "left") {
      setIsResizingLeft(true)
    } else {
      setIsResizingMiddle(true)
    }
  }, [])

  const handlePanelMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(600, e.clientX))
        setLeftPanelWidth(newWidth)
      } else if (isResizingMiddle) {
        const newWidth = Math.max(200, Math.min(500, e.clientX - leftPanelWidth))
        setMiddlePanelWidth(newWidth)
      }
    },
    [isResizingLeft, isResizingMiddle, leftPanelWidth],
  )

  const handlePanelMouseUp = useCallback(() => {
    setIsResizingLeft(false)
    setIsResizingMiddle(false)
  }, [])

  useEffect(() => {
    if (isResizingLeft || isResizingMiddle) {
      document.addEventListener("mousemove", handlePanelMouseMove)
      document.addEventListener("mouseup", handlePanelMouseUp)
      return () => {
        document.removeEventListener("mousemove", handlePanelMouseMove)
        document.removeEventListener("mouseup", handlePanelMouseUp)
      }
    }
  }, [isResizingLeft, isResizingMiddle, handlePanelMouseMove, handlePanelMouseUp])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const currentImage = getCurrentImage()
      if (!currentImage) return

      const coords = getCanvasCoordinates(e.clientX, e.clientY)
      const clickedBox = getBoxAtPoint(coords.x, coords.y)

      setIsDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })

      if (clickedBox) {
        const handle = getResizeHandle(coords.x, coords.y, clickedBox)
        if (handle) {
          setDragType("resize")
          setResizeHandle(handle)
          setDragBoxId(clickedBox.id)
          setSelectedBoxId(clickedBox.id)
        } else {
          setDragType("box")
          setDragBoxId(clickedBox.id)
          setSelectedBoxId(clickedBox.id)
        }
      } else {
        setDragType("canvas")
        setSelectedBoxId(null)
      }
    },
    [getCurrentImage, getCanvasCoordinates, getBoxAtPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const currentImage = getCurrentImage()
      if (currentImage) {
        const coords = getCanvasCoordinates(e.clientX, e.clientY)
        if (
          coords.x >= 0 &&
          coords.x <= currentImage.image.width &&
          coords.y >= 0 &&
          coords.y <= currentImage.image.height
        ) {
          setMousePosition({ x: Math.round(coords.x), y: Math.round(coords.y) })
        } else {
          setMousePosition(null)
        }
      }

      if (!isDragging) {
        if (currentImage && selectedBoxId) {
          const coords = getCanvasCoordinates(e.clientX, e.clientY)
          const selectedBox = currentImage.boxes.find((box) => box.id === selectedBoxId)
          if (selectedBox) {
            const handle = getResizeHandle(coords.x, coords.y, selectedBox)
            const canvas = canvasRef.current
            if (canvas) {
              if (handle === "tl" || handle === "br") {
                canvas.style.cursor = "nw-resize"
              } else if (handle === "tr" || handle === "bl") {
                canvas.style.cursor = "ne-resize"
              } else if (handle === "top" || handle === "bottom") {
                canvas.style.cursor = "ns-resize"
              } else if (handle === "left" || handle === "right") {
                canvas.style.cursor = "ew-resize"
              } else if (getBoxAtPoint(coords.x, coords.y)) {
                canvas.style.cursor = "move"
              } else {
                canvas.style.cursor = "grab"
              }
            }
          }
        }
        return
      }

      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y

      if (dragType === "canvas") {
        setImages((prev) =>
          prev.map((img) =>
            img.id === currentImageId
              ? {
                  ...img,
                  viewState: {
                    ...img.viewState,
                    offsetX: img.viewState.offsetX + deltaX,
                    offsetY: img.viewState.offsetY + deltaY,
                  },
                }
              : img,
          ),
        )
      } else if (dragType === "box" && dragBoxId) {
        const currentImage = getCurrentImage()
        if (!currentImage) return

        const scaledDeltaX = deltaX / currentImage.viewState.scale
        const scaledDeltaY = deltaY / currentImage.viewState.scale

        setImages((prev) =>
          prev.map((img) =>
            img.id === currentImageId
              ? {
                  ...img,
                  boxes: img.boxes.map((box) =>
                    box.id === dragBoxId
                      ? {
                          ...box,
                          x1: box.x1 + scaledDeltaX,
                          y1: box.y1 + scaledDeltaY,
                          x2: box.x2 + scaledDeltaX,
                          y2: box.y2 + scaledDeltaY,
                        }
                      : box,
                  ),
                }
              : img,
          ),
        )
      } else if (dragType === "resize" && dragBoxId && resizeHandle) {
        const currentImage = getCurrentImage()
        if (!currentImage) return

        const scaledDeltaX = deltaX / currentImage.viewState.scale
        const scaledDeltaY = deltaY / currentImage.viewState.scale

        setImages((prev) =>
          prev.map((img) =>
            img.id === currentImageId
              ? {
                  ...img,
                  boxes: img.boxes.map((box) => {
                    if (box.id !== dragBoxId) return box

                    const newBox = { ...box }

                    switch (resizeHandle) {
                      case "tl":
                        newBox.x1 += scaledDeltaX
                        newBox.y1 += scaledDeltaY
                        break
                      case "tr":
                        newBox.x2 += scaledDeltaX
                        newBox.y1 += scaledDeltaY
                        break
                      case "bl":
                        newBox.x1 += scaledDeltaX
                        newBox.y2 += scaledDeltaY
                        break
                      case "br":
                        newBox.x2 += scaledDeltaX
                        newBox.y2 += scaledDeltaY
                        break
                      case "top":
                        newBox.y1 += scaledDeltaY
                        break
                      case "bottom":
                        newBox.y2 += scaledDeltaY
                        break
                      case "left":
                        newBox.x1 += scaledDeltaX
                        break
                      case "right":
                        newBox.x2 += scaledDeltaX
                        break
                    }

                    // 确保边界框不会翻转
                    if (newBox.x1 >= newBox.x2) {
                      if (resizeHandle?.includes("l")) newBox.x1 = newBox.x2 - 1
                      else newBox.x2 = newBox.x1 + 1
                    }
                    if (newBox.y1 >= newBox.y2) {
                      if (resizeHandle?.includes("t")) newBox.y1 = newBox.y2 - 1
                      else newBox.y2 = newBox.y1 + 1
                    }

                    return newBox
                  }),
                }
              : img,
          ),
        )
      }

      setDragStart({ x: e.clientX, y: e.clientY })
    },
    [
      isDragging,
      dragStart,
      dragType,
      dragBoxId,
      resizeHandle,
      getCurrentImage,
      getCanvasCoordinates,
      selectedBoxId,
      currentImageId,
    ],
  )

  const handleMouseLeave = useCallback(() => {
    setMousePosition(null)
    setIsDragging(false)
    setDragType(null)
    setDragBoxId(null)
    setResizeHandle(null)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragType(null)
    setDragBoxId(null)
    setResizeHandle(null)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const currentImage = getCurrentImage()
      if (!currentImage) return

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = currentImage.viewState.scale * zoomFactor // 移除最大值限制

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      setImages((prev) =>
        prev.map((img) =>
          img.id === currentImageId
            ? {
                ...img,
                viewState: {
                  scale: newScale,
                  offsetX: mouseX - (mouseX - img.viewState.offsetX) * (newScale / img.viewState.scale),
                  offsetY: mouseY - (mouseY - img.viewState.offsetY) * (newScale / img.viewState.scale),
                },
              }
            : img,
        ),
      )
    },
    [getCurrentImage, currentImageId],
  )

  const zoomIn = useCallback(() => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === currentImageId ? { ...img, viewState: { ...img.viewState, scale: img.viewState.scale * 1.2 } } : img,
      ),
    )
  }, [currentImageId])

  const zoomOut = useCallback(() => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === currentImageId
          ? { ...img, viewState: { ...img.viewState, scale: Math.max(0.1, img.viewState.scale / 1.2) } }
          : img,
      ),
    )
  }, [currentImageId])

  const resetView = useCallback(() => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === currentImageId ? { ...img, viewState: { scale: 1, offsetX: 0, offsetY: 0 } } : img,
      ),
    )
  }, [currentImageId])

  const downloadCanvasImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement("a")
    const currentImage = getCurrentImage()
    if (!currentImage) return

    link.download = currentImage.name.split(".")[0] + "-with-boxes.png"
    link.href = canvas.toDataURL()
    link.click()
  }, [getCurrentImage])

  const parseBoxInput = (input: string): Box[] => {
    const trimmed = input.trim()
    if (!trimmed) return []

    try {
      if (trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          if (Array.isArray(parsed[0])) {
            return parsed.map((coords: number[], index: number) => {
              if (coords.length !== 4) throw new Error("每个边界框需要4个坐标")
              return {
                x1: coords[0],
                y1: coords[1],
                x2: coords[2],
                y2: coords[3],
                id: `${Date.now()}-${index}`,
                visible: true,
                color: colors[index % colors.length],
              }
            })
          } else {
            if (parsed.length !== 4) throw new Error("边界框需要4个坐标")
            return [
              {
                x1: parsed[0],
                y1: parsed[1],
                x2: parsed[2],
                y2: parsed[3],
                id: Date.now().toString(),
                visible: true,
                color: colors[0],
              },
            ]
          }
        }
      } else {
        const coords = trimmed.split(",").map((s) => Number.parseFloat(s.trim()))
        if (coords.length !== 4) throw new Error("需要4个坐标，用逗号分隔")
        if (coords.some(isNaN)) throw new Error("所有坐标必须是有效数字")

        return [
          {
            x1: coords[0],
            y1: coords[1],
            x2: coords[2],
            y2: coords[3],
            id: Date.now().toString(),
            visible: true,
            color: colors[0],
          },
        ]
      }
      
      // 如果上面的逻辑没有返回结果，抛出错误
      throw new Error("无法解析输入格式")
    } catch (error) {
      // 尝试使用正则表达式解析
      const regex = /\[\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\]/g;
      const boxes: Box[] = [];
      let match;
      let index = 0;

      while ((match = regex.exec(trimmed)) !== null) {
        boxes.push({
          x1: Number(match[1]),
          y1: Number(match[2]),
          x2: Number(match[3]),
          y2: Number(match[4]),
          id: `${Date.now()}-${index}`,
          visible: true,
          color: colors[index % colors.length],
        });
        index++;
      }

      if (boxes.length > 0) {
        return boxes;
      }

      // 如果正则表达式也没有找到匹配，抛出原始错误
      throw new Error(`解析失败: ${error instanceof Error ? error.message : "未知错误"}`)
    }
  }

  const addBoxesFromInput = useCallback(() => {
    if (!currentImageId) return

    try {
      const newBoxes = parseBoxInput(boxInput)

      for (const box of newBoxes) {
        if (box.x1 >= box.x2 || box.y1 >= box.y2) {
          alert("右下角坐标必须大于左上角坐标")
          return
        }
      }

      setImages((prev) =>
        prev.map((img) => (img.id === currentImageId ? { ...img, boxes: [...img.boxes, ...newBoxes] } : img)),
      )

      setBoxInput("")
      if (newBoxes.length > 0) {
        setSelectedBoxId(newBoxes[0].id)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "输入格式错误")
    }
  }, [boxInput, colors, currentImageId])

  const getResizeHandle = useCallback(
    (x: number, y: number, box: Box) => {
      const currentImage = getCurrentImage()
      if (!currentImage) return null

      const handleSize = 8 / currentImage.viewState.scale
      const tolerance = handleSize

      // 检查四个角点
      if (Math.abs(x - box.x1) <= tolerance && Math.abs(y - box.y1) <= tolerance) return "tl"
      if (Math.abs(x - box.x2) <= tolerance && Math.abs(y - box.y1) <= tolerance) return "tr"
      if (Math.abs(x - box.x1) <= tolerance && Math.abs(y - box.y2) <= tolerance) return "bl"
      if (Math.abs(x - box.x2) <= tolerance && Math.abs(y - box.y2) <= tolerance) return "br"

      // 检查边
      if (Math.abs(y - box.y1) <= tolerance && x > box.x1 + tolerance && x < box.x2 - tolerance) return "top"
      if (Math.abs(y - box.y2) <= tolerance && x > box.x1 + tolerance && x < box.x2 - tolerance) return "bottom"
      if (Math.abs(x - box.x1) <= tolerance && y > box.y1 + tolerance && y < box.y2 - tolerance) return "left"
      if (Math.abs(x - box.x2) <= tolerance && y > box.y1 + tolerance && y < box.y2 - tolerance) return "right"

      return null
    },
    [getCurrentImage],
  )

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const imageId = `${Date.now()}-${Math.random()}`
        const newImageData: ImageData = {
          id: imageId,
          name: file.name,
          image: img,
          boxes: [],
          viewState: { scale: 1, offsetX: 0, offsetY: 0 },
        }

        setImages((prev) => [...prev, newImageData])
        setCurrentImageId(imageId)
        setSelectedBoxId(null)
      }
      img.src = URL.createObjectURL(file)
    })
  }, [])

  const removeImage = useCallback(
    (imageId: string) => {
      setImages((prev) => {
        const filtered = prev.filter((img) => img.id !== imageId)
        if (currentImageId === imageId) {
          setCurrentImageId(filtered.length > 0 ? filtered[0].id : null)
          setSelectedBoxId(null)
        }
        return filtered
      })
    },
    [currentImageId],
  )

  const saveToLocalStorage = useCallback(() => {
    try {
      const dataToSave = images.map((img) => ({
        id: img.id,
        name: img.name,
        boxes: img.boxes,
        viewState: img.viewState,
        imageData: img.image.src,
      }))
      localStorage.setItem("imageMaskApp_data", JSON.stringify(dataToSave))
      localStorage.setItem("imageMaskApp_currentImageId", currentImageId || "")
      localStorage.setItem(
        "imageMaskApp_panelWidths",
        JSON.stringify({
          leftPanelWidth,
          middlePanelWidth,
        }),
      )
    } catch (error) {
      console.error("保存到本地存储失败:", error)
    }
  }, [images, currentImageId, leftPanelWidth, middlePanelWidth])

  const loadFromLocalStorage = useCallback(() => {
    try {
      const savedData = localStorage.getItem("imageMaskApp_data")
      const savedCurrentImageId = localStorage.getItem("imageMaskApp_currentImageId")
      const savedPanelWidths = localStorage.getItem("imageMaskApp_panelWidths")

      if (savedData) {
        const parsedData = JSON.parse(savedData)
        const loadedImages: ImageData[] = []

        parsedData.forEach((item: any) => {
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            const imageData: ImageData = {
              id: item.id,
              name: item.name,
              image: img,
              boxes: item.boxes,
              viewState: item.viewState,
            }
            loadedImages.push(imageData)

            if (loadedImages.length === parsedData.length) {
              setImages(loadedImages)
              if (savedCurrentImageId && loadedImages.find((img) => img.id === savedCurrentImageId)) {
                setCurrentImageId(savedCurrentImageId)
              }
            }
          }
          img.src = item.imageData
        })
      }

      if (savedPanelWidths) {
        const panelWidths = JSON.parse(savedPanelWidths)
        setLeftPanelWidth(panelWidths.leftPanelWidth || 320)
        setMiddlePanelWidth(panelWidths.middlePanelWidth || 288)
      }
    } catch (error) {
      console.error("从本地存储加载失败:", error)
    }
  }, [])

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  useEffect(() => {
    if (images.length > 0) {
      saveToLocalStorage()
    }
  }, [images, currentImageId, leftPanelWidth, middlePanelWidth, saveToLocalStorage])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // 复制单个边界框
  const copyBox = useCallback((box: Box) => {
    // 创建一个新的边界框，保持相同的坐标但使用新的ID
    const newBox: Box = {
      ...box,
      id: `${Date.now()}-copy`,
      // 稍微偏移一点，以便用户可以看到它是一个新的框
      x1: box.x1 + 10,
      y1: box.y1 + 10,
      x2: box.x2 + 10,
      y2: box.y2 + 10,
    }
    
    // 添加到当前图像，插入到原始边界框后面
    setImages((prev) =>
      prev.map((img) => {
        if (img.id === currentImageId) {
          const boxIndex = img.boxes.findIndex(b => b.id === box.id)
          if (boxIndex !== -1) {
            // 创建新数组，将新边界框插入到原始边界框后面
            const newBoxes = [...img.boxes]
            newBoxes.splice(boxIndex + 1, 0, newBox)
            return { ...img, boxes: newBoxes }
          }
          // 如果找不到原始边界框（不应该发生），则追加到末尾
          return { ...img, boxes: [...img.boxes, newBox] }
        }
        return img
      })
    )
    
    // 选中新复制的边界框
    setSelectedBoxId(newBox.id)
  }, [currentImageId])
  
  const exportBoxesData = useCallback(() => {
    const currentImage = getCurrentImage()
    if (!currentImage || currentImage.boxes.length === 0) return

    const boxData = currentImage.boxes.map((box) => [
      Math.round(box.x1),
      Math.round(box.y1),
      Math.round(box.x2),
      Math.round(box.y2),
    ])

    // 创建一个更简洁的格式
    const formattedData = JSON.stringify(boxData)
      .replace(/\],\[/g, '],\n[')
      .replace('[[', '[\n[')
      .replace(']]', ']\n]')

    navigator.clipboard.writeText(formattedData)
    
    // 显示提示
    alert("边界框数据已复制到剪贴板！")
  }, [getCurrentImage])

  const currentImage = getCurrentImage()

  return (
    <div className={`h-screen flex flex-col ${isDarkMode ? "dark" : ""}`}>
      <div className="bg-background text-foreground h-full flex flex-col">
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Square className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="font-semibold text-lg">图像标注工具</h1>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {currentImage && (
                <>
                  <span>{currentImage.name}</span>
                  <span>•</span>
                  <span>{currentImage.boxes.length} 个边界框</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentImage && (
              <div className="flex items-center gap-1 mr-2">
                <Button variant="ghost" size="sm" onClick={zoomOut} className="h-8 w-8 p-0">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
                  {Math.round(currentImage.viewState.scale * 100)}%
                </span>
                <Button variant="ghost" size="sm" onClick={zoomIn} className="h-8 w-8 p-0">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={resetView} className="h-8 w-8 p-0">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            )}

            <Button variant="ghost" size="sm" onClick={() => setIsDarkMode(!isDarkMode)} className="h-8 w-8 p-0">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={downloadCanvasImage}
              disabled={!currentImage}
              className="h-8 w-8 p-0"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <div className="h-[calc(100%-3.5rem-2.25rem)] flex overflow-hidden">
          <aside
            className="border-r border-border bg-sidebar/30 flex flex-col relative h-full"
            style={{ width: leftPanelWidth }}
          >
            <div className="p-4 border-b border-border">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} className="w-full gap-2" size="sm">
                <Upload className="w-4 h-4" />
                上传图片
              </Button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-0">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">图片列表</span>
                <span className="text-xs text-muted-foreground">({images.length})</span>
              </div>
            </div>
            
            <div className="h-[calc(100%-8.5rem)] overflow-hidden">
              <div className="h-full overflow-y-auto p-4 pt-2">
                {images.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无图片</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {images.map((img) => (
                      <div
                        key={img.id}
                        className={`group relative rounded-lg border transition-all cursor-pointer ${
                          currentImageId === img.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
                        }`}
                        onClick={() => {
                          setCurrentImageId(img.id)
                          setSelectedBoxId(null)
                        }}
                      >
                        <div className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                              <img
                                src={img.image.src || "/placeholder.svg"}
                                alt={img.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">{img.name}</h3>
                              <p className="text-xs text-foreground/70 mt-1">
                                {img.image.width} × {img.image.height}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex items-center gap-1">
                                  <Square className="w-3 h-3 text-foreground/60" />
                                  <span className="text-xs text-foreground/70">{img.boxes.length}</span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeImage(img.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>

          <aside
            className="border-r border-border bg-sidebar/20 flex flex-col relative h-full"
            style={{ width: middlePanelWidth }}
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">边界框</span>
              </div>

                <div className="space-y-3">
                  <div className="relative">
                    <Textarea
                      placeholder="输入坐标格式：&#10;[206, 67, 252, 100]&#10;[[206, 67, 252, 100], [208, 144, 499, 438]]&#10;208, 144, 499, 438"
                      value={boxInput}
                      onChange={(e) => setBoxInput(e.target.value)}
                      className="min-h-[60px] max-h-[120px] text-xs resize-y overflow-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addBoxesFromInput}
                      disabled={!boxInput.trim()}
                      className="h-8 bg-transparent"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      添加
                    </Button>
                  </div>
                </div>
            </div>

            <div className="p-2 border-b border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">边界框列表 ({currentImage?.boxes.length || 0})</span>
                <div className="flex items-center gap-1">
                  {currentImage && currentImage.boxes.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={exportBoxesData}
                        title="导出边界框数据"
                        className="h-5 w-5 p-0"
                      >
                        <Download className="w-3 h-3 text-foreground/70" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (currentImage) {
                            setImages((prev) =>
                              prev.map((img) => (img.id === currentImageId ? { ...img, boxes: [] } : img)),
                            )
                            setSelectedBoxId(null)
                          }
                        }}
                        className="text-destructive hover:text-destructive h-5 px-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="h-[calc(100%-14.5rem)] overflow-hidden">
              <div className="h-full overflow-y-auto p-2">
                {currentImage && currentImage.boxes.length > 0 ? (
                  <div className="space-y-1">
                    {currentImage.boxes.map((box, index) => (
                      <div
                        key={box.id}
                        className={`group rounded border p-2 transition-all cursor-pointer ${
                          selectedBoxId === box.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedBoxId(selectedBoxId === box.id ? null : box.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-sm border" style={{ backgroundColor: box.color }} />
                            <span className="text-xs font-medium">#{index + 1}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setImages((prev) =>
                                  prev.map((img) =>
                                    img.id === currentImageId
                                      ? {
                                          ...img,
                                          boxes: img.boxes.map((b) =>
                                            b.id === box.id ? { ...b, visible: !b.visible } : b,
                                          ),
                                        }
                                      : img,
                                  ),
                                )
                              }}
                              className="h-5 w-5 p-0"
                            >
                              {box.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyBox(box)
                              }}
                              title="复制此边界框"
                              className="h-5 w-5 p-0"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setImages((prev) =>
                                  prev.map((img) =>
                                    img.id === currentImageId
                                      ? { ...img, boxes: img.boxes.filter((b) => b.id !== box.id) }
                                      : img,
                                  ),
                                )
                                if (selectedBoxId === box.id) {
                                  setSelectedBoxId(null)
                                }
                              }}
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground mb-1">
                          [{Math.round(box.x1)}, {Math.round(box.y1)}, {Math.round(box.x2)}, {Math.round(box.y2)}]
                        </div>

                        <div className="flex gap-0.5">
                          {colors.slice(0, 6).map((color) => (
                            <button
                              key={color}
                              className={`w-3 h-3 rounded border transition-all ${
                                box.color === color
                                  ? "border-foreground scale-110"
                                  : "border-transparent hover:border-muted-foreground"
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setImages((prev) =>
                                  prev.map((img) =>
                                    img.id === currentImageId
                                      ? {
                                          ...img,
                                          boxes: img.boxes.map((b) => (b.id === box.id ? { ...b, color } : b)),
                                        }
                                      : img,
                                  ),
                                )
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    <Square className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无边界框</p>
                    <p className="text-xs mt-1">添加坐标来创建边界框</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="flex-1 flex flex-col bg-muted/20 h-full">
            {currentImage ? (
              <>
                <div className="h-10 border-b border-border bg-card/30 flex items-center justify-between px-4 text-xs text-foreground/80">
                  <div className="flex items-center gap-4">
                    <span>
                      图像: {currentImage.image.width} × {currentImage.image.height}
                    </span>
                    <span>缩放: {Math.round(currentImage.viewState.scale * 100)}%</span>
                    {mousePosition && (
                      <span>
                        坐标: ({mousePosition.x}, {mousePosition.y})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>使用滚轮缩放，拖拽平移</span>
                  </div>
                </div>

                <div
                  ref={containerRef}
                  className="h-[calc(100%-2.5rem)] relative overflow-auto bg-gradient-to-br from-muted/30 to-muted/10"
                >
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onWheel={handleWheel}
                  />
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center bg-gradient-to-br from-muted/30 to-muted/10">
                <div className="max-w-md">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">开始图像标注</h2>
                  <p className="text-muted-foreground mb-6">
                    上传图片开始创建边界框标注。支持多张图片处理、实时预览和交互式编辑。
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" />
                    选择图片文件
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>

        <footer className="border-t bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-primary">liferecords</p>
              <p className="text-xs text-foreground/80 mt-1">致力于日常小工具的开发 • 邮箱: <span className="font-medium">yjmm10@yeah.net</span></p>
            </div>
          </div>
        </footer>
      </div>
      <div
        className="absolute top-0 left-[calc(var(--left-panel-width)-2px)] w-4 h-full cursor-col-resize group z-10"
        style={{ "--left-panel-width": `${leftPanelWidth}px` } as React.CSSProperties}
        onMouseDown={(e) => handlePanelMouseDown(e, "left")}
      >
        <div className="absolute left-1 top-0 bottom-0 w-[2px] bg-border group-hover:bg-primary/60 transition-colors">
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-10 flex items-center justify-center">
            <div className="w-[3px] h-6 rounded-full bg-border/80 group-hover:bg-primary/80 transition-colors"></div>
          </div>
        </div>
      </div>

      {/* 在中间面板也添加分隔条 */}
      <div
        className="absolute top-0 left-[calc(var(--left-panel-width)+var(--middle-panel-width)-2px)] w-4 h-full cursor-col-resize group z-10"
        style={{ 
          "--left-panel-width": `${leftPanelWidth}px`,
          "--middle-panel-width": `${middlePanelWidth}px`
        } as React.CSSProperties}
        onMouseDown={(e) => handlePanelMouseDown(e, "middle")}
      >
        <div className="absolute left-1 top-0 bottom-0 w-[2px] bg-border group-hover:bg-primary/60 transition-colors">
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4 h-10 flex items-center justify-center">
            <div className="w-[3px] h-6 rounded-full bg-border/80 group-hover:bg-primary/80 transition-colors"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
