'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Lightbulb, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'

export type QuizQuestion = {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
}

type QuizPanelProps = {
  nodeId: string
  nodeLabel: string
  domain: string
  onGenerateQuiz: () => Promise<QuizQuestion[]>
}

export function QuizPanel({ nodeId, nodeLabel, domain, onGenerateQuiz }: QuizPanelProps) {
  void nodeId
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const currentQuestion = questions[currentQuestionIndex]

  const handleGenerateQuiz = async () => {
    setIsLoading(true)
    try {
      const generatedQuestions = await onGenerateQuiz()
      setQuestions(generatedQuestions)
      setCurrentQuestionIndex(0)
      setSelectedAnswer(null)
      setIsAnswered(false)
      setScore(0)
      setShowResults(false)
    } catch (error) {
      console.error('生成 Quiz 失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAnswer = (optionIndex: number) => {
    if (isAnswered) return
    setSelectedAnswer(optionIndex)
  }

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return
    setIsAnswered(true)
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(score + 1)
    }
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer(null)
      setIsAnswered(false)
    } else {
      setShowResults(true)
    }
  }

  const handleRestart = () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setScore(0)
    setShowResults(false)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-emerald-400 bg-emerald-400/20 border-emerald-400/30'
      case 'medium':
        return 'text-amber-400 bg-amber-400/20 border-amber-400/30'
      case 'hard':
        return 'text-pink-400 bg-pink-400/20 border-pink-400/30'
      default:
        return 'text-slate-400 bg-slate-400/20 border-slate-400/30'
    }
  }

  // 初始状态：未生成 Quiz
  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="glass-effect border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white mb-3 title-font">AI 智能问答</h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            基于 <span className="text-amber-400 font-bold">{nodeLabel}</span> 的内容，AI 将为你生成定制化的互动问答题目，
            帮助你深入理解 <span className="text-emerald-400 font-bold">{domain}</span> 的核心概念。
          </p>
          <button
            onClick={handleGenerateQuiz}
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold transition-all shadow-lg shadow-amber-500/30 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <RotateCcw className="w-5 h-5 mr-2 inline animate-spin" />
                AI 生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2 inline" />
                生成 Quiz
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // 结果页面
  if (showResults) {
    const percentage = Math.round((score / questions.length) * 100)
    const isPassed = percentage >= 70

    return (
      <div className="space-y-6">
        <div className="glass-effect border border-white/10 rounded-2xl p-8 text-center">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isPassed
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30'
                : 'bg-gradient-to-br from-pink-400 to-pink-500 shadow-lg shadow-pink-500/30'
            }`}
          >
            {isPassed ? (
              <CheckCircle2 className="w-12 h-12 text-white" />
            ) : (
              <XCircle className="w-12 h-12 text-white" />
            )}
          </div>
          <h3 className="text-2xl font-black text-white mb-3 title-font">
            {isPassed ? '恭喜通过！' : '继续加油！'}
          </h3>
          <p className="text-4xl font-black text-amber-400 mb-2">
            {score} / {questions.length}
          </p>
          <p className="text-sm text-slate-400 mb-8">正确率: {percentage}%</p>

          <div className="flex gap-4">
            <button
              onClick={handleRestart}
              className="flex-1 px-6 py-3 rounded-xl glass-effect border border-white/10 hover:bg-white/10 text-white font-bold transition-all"
            >
              <RotateCcw className="w-5 h-5 mr-2 inline" />
              重新测试
            </button>
            <button
              onClick={handleGenerateQuiz}
              disabled={isLoading}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold transition-all shadow-lg shadow-amber-500/30"
            >
              <Sparkles className="w-5 h-5 mr-2 inline" />
              生成新题
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 问答页面
  return (
    <div className="space-y-6">
      {/* 进度条 */}
      <div className="glass-effect border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-400 mono-font">
            问题 {currentQuestionIndex + 1} / {questions.length}
          </span>
          <span className="text-sm font-bold text-amber-400">
            得分: {score}
          </span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 问题卡片 */}
      <div className="glass-effect border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${getDifficultyColor(
              currentQuestion.difficulty
            )}`}
          >
            {currentQuestion.difficulty}
          </span>
        </div>

        <h3 className="text-lg font-bold text-white mb-6 leading-relaxed">
          {currentQuestion.question}
        </h3>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index
            const isCorrect = index === currentQuestion.correctAnswer
            const showResult = isAnswered

            let buttonClass = 'glass-effect border border-white/10 hover:bg-white/10'
            if (showResult) {
              if (isCorrect) {
                buttonClass = 'bg-emerald-500/20 border-emerald-400/50'
              } else if (isSelected && !isCorrect) {
                buttonClass = 'bg-pink-500/20 border-pink-400/50'
              }
            } else if (isSelected) {
              buttonClass = 'bg-amber-500/20 border-amber-400/50'
            }

            return (
              <button
                key={index}
                onClick={() => handleSelectAnswer(index)}
                disabled={isAnswered}
                className={`w-full text-left px-5 py-4 rounded-xl transition-all ${buttonClass} ${
                  isAnswered ? 'cursor-default' : 'hover:scale-102'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200 flex-1">{option}</span>
                  {showResult && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-3" />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-pink-400 ml-3" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* 解释 */}
        {isAnswered && (
          <div className="mt-6 p-5 rounded-xl bg-blue-500/10 border border-blue-400/30">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-400 mb-2">解释</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex gap-3">
          {!isAnswered ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              提交答案
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
            >
              {currentQuestionIndex < questions.length - 1 ? '下一题' : '查看结果'}
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
