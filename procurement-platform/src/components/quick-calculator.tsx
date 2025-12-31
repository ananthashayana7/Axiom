"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger, DialogDrawer, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Calculator } from 'lucide-react'

export default function QuickCalculator() {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [newInput, setNewInput] = useState(true)

  const handleNumber = (num: string) => {
    if (newInput) {
      setDisplay(num)
      setNewInput(false)
    } else {
      setDisplay(display === '0' ? num : display + num)
    }
  }

  const handleDecimal = () => {
    if (newInput) {
      setDisplay('0.')
      setNewInput(false)
    } else if (!display.includes('.')) {
      setDisplay(display + '.')
    }
  }

  const handleOperation = (op: string) => {
    const current = parseFloat(display)
    if (prev !== null && operation && !newInput) {
      const result = calculate(prev, current, operation)
      setDisplay(String(result))
      setPrev(result)
    } else {
      setPrev(current)
    }
    setOperation(op)
    setNewInput(true)
  }

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return a / b
      case '%': return a % b
      default: return b
    }
  }

  const handleEquals = () => {
    const current = parseFloat(display)
    if (prev !== null && operation) {
      const result = calculate(prev, current, operation)
      setDisplay(String(result))
      setPrev(null)
      setOperation(null)
      setNewInput(true)
    }
  }

  const handleClear = () => {
    setDisplay('0')
    setPrev(null)
    setOperation(null)
    setNewInput(true)
  }

  const handleBackspace = () => {
    if (display.length === 1) {
      setDisplay('0')
      setNewInput(true)
    } else {
      setDisplay(display.slice(0, -1))
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open) return

    const key = e.key

    // Numbers 0-9
    if (/^[0-9]$/.test(key)) {
      e.preventDefault()
      handleNumber(key)
      return
    }

    // Decimal point
    if (key === '.') {
      e.preventDefault()
      handleDecimal()
      return
    }

    // Operations
    if (key === '+' || key === '-' || key === '/') {
      e.preventDefault()
      handleOperation(key)
      return
    }

    // Multiplication (*)
    if (key === '*') {
      e.preventDefault()
      handleOperation('*')
      return
    }

    // Equals (Enter or =)
    if (key === 'Enter' || key === '=') {
      e.preventDefault()
      handleEquals()
      return
    }

    // Backspace
    if (key === 'Backspace') {
      e.preventDefault()
      handleBackspace()
      return
    }

    // Clear (Escape or c)
    if (key === 'Escape' || key.toLowerCase() === 'c') {
      e.preventDefault()
      handleClear()
      return
    }
  }

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, display, prev, operation, newInput])

  const buttonClass = 'h-12 font-semibold text-lg'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Quick calculator">
          <Calculator className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogDrawer className="w-[320px]">
        <DialogHeader>
          <DialogTitle>Calculator</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          <div className="bg-muted p-4 rounded text-right text-3xl font-bold break-words">
            {display}
          </div>

          <div className="grid grid-cols-4 gap-1">
            <Button variant="outline" className={buttonClass} onClick={handleClear}>AC</Button>
            <Button variant="outline" className={buttonClass} onClick={handleBackspace}>⌫</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleOperation('%')}>%</Button>
            <Button className={buttonClass} onClick={() => handleOperation('/')}>/</Button>

            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('7')}>7</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('8')}>8</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('9')}>9</Button>
            <Button className={buttonClass} onClick={() => handleOperation('*')}>×</Button>

            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('4')}>4</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('5')}>5</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('6')}>6</Button>
            <Button className={buttonClass} onClick={() => handleOperation('-')}>−</Button>

            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('1')}>1</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('2')}>2</Button>
            <Button variant="outline" className={buttonClass} onClick={() => handleNumber('3')}>3</Button>
            <Button className={buttonClass} onClick={() => handleOperation('+')}>+</Button>

            <Button variant="outline" className={`${buttonClass} col-span-2`} onClick={() => handleNumber('0')}>0</Button>
            <Button variant="outline" className={buttonClass} onClick={handleDecimal}>.</Button>
            <Button className={buttonClass} onClick={handleEquals}>=</Button>
          </div>
        </div>
      </DialogDrawer>
    </Dialog>
  )
}
