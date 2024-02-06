import { La, LaEvent } from "loud-array"
import { styled } from "@pjack/styled-elements"

// TODO: Options, styles
// TODO: gaps
// TODO: unbind
// TODO: unbind on element removal, it is way easier that way
// 

const applySymbol = Symbol("apply")
const unapplySymbol = Symbol("unapply")

interface Apply<T> {
  [applySymbol]:(model:T)=>void,
  [unapplySymbol]:(model:T)=>void
}

type Elem<T> = HTMLElement & Apply<T>

export interface Cell<T> {
  element:HTMLElement,
  apply:(model:T)=>void,
  unapply:(model:T)=>void
}

export interface Options<T> {
  readonly cellWidth:number
  readonly cellHeight:number
  readonly newCell:()=>Cell<T>
  readonly container?:()=>HTMLElement
  readonly grid?:()=>HTMLElement
}

const Container = styled("div")`
  flex-grow:1;
  overflow:scroll;
`

const Grid = styled("ul")`
  position:relative;
  width:100%;
  list-style-type:none;
  margin-block-start:0;
  margin-block-end:0;
  margin-inline-start:0;
  margin-inline-end:0;
  padding-inline-start:0;
  padding-inline-end:0;
`

// TODO, check these things are garbage collected

export const gridView = <T>(la:La<T>, options:Options<T>) => {
  const container = (options.container ?? Container)()
  const result = (options.grid ?? Grid)()
  container.appendChild(result)
  const { cellWidth, cellHeight, newCell } = options
  let viewPortWidth = -1
  let viewPortHeight =  -1
  let fullHeight = -1
  let cols = 0
  let rows = 0
  let visibleRows = 0
  const bank:Elem<T>[] = []
  const getFromBank = ():Elem<T> => {
    if (bank.length > 0) {
      return bank.pop()!
    }
    const n = newCell();
    n.element.style.position = "absolute";
    n.element.style.width = cellWidth + "px";
    n.element.style.height = cellHeight + "px";
    (n.element as any)[applySymbol] = n.apply;
    (n.element as any)[unapplySymbol] = n.unapply
    return n.element as Elem<T>
  }

  let redrawing = false // TODO, not needed?
  const redraw = () => {
    if (redrawing) {
      console.log("already")
      return;
    }
    redrawing = true;
    if (cols <=  0) {
      redrawing = false
      return
    }
    if (viewPortHeight <= 0) {
      redrawing = false
      return
    }
    for (const child of [...result.childNodes]) {
      result.removeChild(child)
      bank.push(child as Elem<T>)
    }
    const ofsY = container.scrollTop
    const firstRow = Math.floor(ofsY / cellHeight)
    let index = firstRow * cols
    for (let row = firstRow; row <= firstRow + visibleRows; row++) {
      for (let col = 0; col < cols; col++) {
        if (index >= la.length) break;
        const cell = getFromBank()
        const left = col * cellWidth
        const top = row * cellHeight
        cell.style.top = top + "px"
        cell.style.left = left + "px"
        cell[applySymbol](la[index]!)
        result.appendChild(cell)
        index++
      }
    }
    redrawing = false
  }
  container.onscroll = () => {
    redraw()
  }
  la.listen((event:LaEvent<T>) => {
    redraw() // TODO, if we have fewer elements scroll offset might be too high
  })
  const observer = new ResizeObserver((entries) => {
    let needsRedraw = false
    viewPortWidth = entries[0]!.contentRect.width
    const newCols = Math.max(1, Math.floor(viewPortWidth / cellWidth))
    if (newCols != cols) {
      console.log(`needsRedraw due to cols:${newCols} vs ${cols}`)
      cols = newCols
      needsRedraw = true
    }
    rows = Math.max(1, Math.floor(la.length / cols))
    const newHeight = rows * cellHeight
    if (newHeight !== fullHeight) {
      console.log(`needsRedraw due to full:${newHeight} vs ${fullHeight}`)
      fullHeight = newHeight
      result.style.height = fullHeight + "px"
      needsRedraw = true
    }
    const parentHeight = result.parentElement?.clientHeight ?? -1
    if (parentHeight !== viewPortHeight) {
      console.log(`needsRedraw due to viewPort:${parentHeight} vs ${viewPortHeight}`)
      needsRedraw = true
      viewPortHeight = parentHeight
      visibleRows = Math.max(1, Math.floor(parentHeight / cellHeight)) + 1
    }
    console.log("REDRAW", needsRedraw, cols + "x" + rows)
    if (needsRedraw) redraw()
  })
  observer.observe(result)
  return container
}