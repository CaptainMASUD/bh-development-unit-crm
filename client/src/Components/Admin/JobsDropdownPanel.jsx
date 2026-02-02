'use client'

import { useState, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus,
  FiRefreshCcw,
  FiEdit2,
  FiTrash2,
  FiChevronRight,
  FiLoader,
  FiAlertCircle,
  FiCornerDownRight,
} from 'react-icons/fi'
import { Loader2 } from 'lucide-react'

const chip = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ring-1'
const btn =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.99] transition focus:outline-none'
const btnPrimary = 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
const btnGhost = 'border border-gray-200 bg-white hover:bg-gray-50'
const iconBtn = 'p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition focus:outline-none'
const iconBtnSmall = 'p-1.5 rounded-md hover:bg-gray-100 transition'

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function JobStatusBadge({ status }) {
  const s = String(status || '').toLowerCase()
  const cls =
    s === 'completed'
      ? 'bg-green-50 text-green-700 ring-green-600/10'
      : s === 'on_hold'
        ? 'bg-amber-50 text-amber-800 ring-amber-600/10'
        : 'bg-sky-50 text-sky-700 ring-sky-600/10'
  return (
    <span className={cn(chip, cls)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40" />
      {s || 'active'}
    </span>
  )
}

function JobItem({ job, isSubJob = false, onEdit, onDelete, onCreateSub, isExpandedForSubjobs, setExpandedSubjobParent }) {
  const [showSubjobs, setShowSubjobs] = useState(isExpandedForSubjobs || false)

  const hasSubjobs = job?.subJobs && job.subJobs.length > 0

  return (
    <Fragment key={job._id}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="group"
      >
        <div
          className={cn(
            'flex items-center justify-between p-4 rounded-xl border transition',
            'hover:bg-gray-50/50 hover:border-gray-200',
            isSubJob ? 'ml-8 bg-gray-50/30 border-gray-150' : 'bg-white border-gray-200'
          )}
        >
          {/* Left Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {/* Expansion Icon for Root Jobs */}
              {!isSubJob && hasSubjobs && (
                <button
                  onClick={() => setShowSubjobs(!showSubjobs)}
                  className={cn(
                    'p-1 rounded-md transition-transform',
                    'hover:bg-indigo-100 text-indigo-600',
                    showSubjobs ? 'rotate-90' : ''
                  )}
                  title={showSubjobs ? 'Collapse' : 'Expand'}
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              )}

              {/* Sub-job indicator */}
              {isSubJob && <FiCornerDownRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}

              {/* Job Title */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 truncate text-sm">{job?.title || 'Untitled Job'}</h4>
                {job?.description && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{job.description}</p>
                )}
              </div>
            </div>

            {/* Tags Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <JobStatusBadge status={job?.status} />
              {job?.priority && (
                <span
                  className={cn(
                    chip,
                    job.priority === 'high'
                      ? 'bg-rose-50 text-rose-700 ring-rose-600/10'
                      : job.priority === 'medium'
                        ? 'bg-amber-50 text-amber-700 ring-amber-600/10'
                        : 'bg-blue-50 text-blue-700 ring-blue-600/10'
                  )}
                >
                  {job.priority}
                </span>
              )}
              {job?.dueDate && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  Due: {new Date(job.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 ml-4">
            {!isSubJob && (
              <button
                onClick={() => onCreateSub(job)}
                className={cn(iconBtn, 'text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200')}
                title="Add sub-job"
                aria-label="Add sub-job"
              >
                <FiPlus className="w-4 h-4" />
              </button>
            )}

            <button onClick={() => onEdit(job)} className={cn(iconBtn)} title="Edit" aria-label="Edit">
              <FiEdit2 className="w-4 h-4 text-blue-600" />
            </button>

            <button
              onClick={() => onDelete(job)}
              className={cn(iconBtn, 'text-rose-600 hover:bg-rose-50 hover:border-rose-200')}
              title="Delete"
              aria-label="Delete"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Sub-jobs List */}
      <AnimatePresence>
        {!isSubJob && showSubjobs && hasSubjobs && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 mt-2"
          >
            {job.subJobs.map((subjob) => (
              <JobItem
                key={subjob._id}
                job={subjob}
                isSubJob={true}
                onEdit={onEdit}
                onDelete={onDelete}
                onCreateSub={onCreateSub}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Fragment>
  )
}

export default function JobsDropdownPanel({
  customer,
  state = { loading: false, error: '', jobsTree: [] },
  onRefresh,
  onCreateRoot,
  onCreateSub,
  onEdit,
  onDelete,
}) {
  const { loading, error, jobsTree = [] } = state

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-gradient-to-b from-indigo-50/40 to-white border-t-2 border-indigo-200"
    >
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Jobs for {customer?.name}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {jobsTree.length} job{jobsTree.length !== 1 ? 's' : ''} • Click to expand and view sub-jobs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className={cn(iconBtn, 'disabled:opacity-50')}
              title="Refresh"
              aria-label="Refresh"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FiRefreshCcw className="w-4 h-4" />}
            </button>

            <button onClick={onCreateRoot} className={cn(btn, btnPrimary, 'text-sm px-3 py-2')} title="Create new job">
              <FiPlus className="w-4 h-4" />
              New Job
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2"
          >
            <FiAlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{error}</p>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && jobsTree.length === 0 && (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm text-gray-500">Loading jobs...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && jobsTree.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200"
          >
            <FiCornerDownRight className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-600 font-medium">No jobs yet</p>
            <p className="text-xs text-gray-500 mt-1">Create your first job to get started</p>
          </motion.div>
        )}

        {/* Jobs List */}
        {!loading && jobsTree.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {jobsTree.map((job) => (
              <JobItem
                key={job._id}
                job={job}
                isSubJob={false}
                onEdit={onEdit}
                onDelete={onDelete}
                onCreateSub={onCreateSub}
              />
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
