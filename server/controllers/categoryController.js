const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { recordAudit } = require('../services/auditService');

// --------------------------------------------------------------------------
// Complaint Categories
// --------------------------------------------------------------------------
async function listCategories(req, res) {
  const categories = await prisma.complaintCategory.findMany({ orderBy: { name: 'asc' } });
  return new ApiResponse(200, { categories }).send(res);
}

async function createCategory(req, res) {
  const { name, description, defaultPriority } = req.body;
  const category = await prisma.complaintCategory.create({ data: { name, description, defaultPriority } });
  await recordAudit({ userId: req.user.id, action: 'CATEGORY_CREATED', entityType: 'ComplaintCategory', entityId: category.id, ipAddress: req.ip });
  return new ApiResponse(201, { category }, 'Category created').send(res);
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, description, defaultPriority, isActive } = req.body;
  const existing = await prisma.complaintCategory.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Category not found');

  const category = await prisma.complaintCategory.update({
    where: { id },
    data: { name, description, defaultPriority, isActive },
  });
  await recordAudit({ userId: req.user.id, action: 'CATEGORY_UPDATED', entityType: 'ComplaintCategory', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, { category }, 'Category updated').send(res);
}

async function deleteCategory(req, res) {
  const { id } = req.params;
  const inUse = await prisma.complaint.count({ where: { categoryId: id } });
  if (inUse > 0) throw ApiError.badRequest('Cannot delete a category that is already used by complaints. Deactivate it instead.');

  await prisma.complaintCategory.delete({ where: { id } });
  await recordAudit({ userId: req.user.id, action: 'CATEGORY_DELETED', entityType: 'ComplaintCategory', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, null, 'Category deleted').send(res);
}

// --------------------------------------------------------------------------
// Priority Rules — Novelty #2 configuration surface
// --------------------------------------------------------------------------
async function listPriorityRules(req, res) {
  const rules = await prisma.priorityRule.findMany({ include: { category: true }, orderBy: { createdAt: 'desc' } });
  return new ApiResponse(200, { rules }).send(res);
}

async function createPriorityRule(req, res) {
  const { keyword, categoryId, priority } = req.body;
  const rule = await prisma.priorityRule.create({ data: { keyword: keyword.toLowerCase(), categoryId: categoryId || null, priority } });
  await recordAudit({ userId: req.user.id, action: 'PRIORITY_RULE_CREATED', entityType: 'PriorityRule', entityId: rule.id, details: { keyword, priority }, ipAddress: req.ip });
  return new ApiResponse(201, { rule }, 'Priority rule created').send(res);
}

async function updatePriorityRule(req, res) {
  const { id } = req.params;
  const { keyword, categoryId, priority, isActive } = req.body;
  const existing = await prisma.priorityRule.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Priority rule not found');

  const rule = await prisma.priorityRule.update({
    where: { id },
    data: {
      ...(keyword ? { keyword: keyword.toLowerCase() } : {}),
      ...(categoryId !== undefined ? { categoryId: categoryId || null } : {}),
      ...(priority ? { priority } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  await recordAudit({ userId: req.user.id, action: 'PRIORITY_RULE_UPDATED', entityType: 'PriorityRule', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, { rule }, 'Priority rule updated').send(res);
}

async function deletePriorityRule(req, res) {
  const { id } = req.params;
  await prisma.priorityRule.delete({ where: { id } });
  await recordAudit({ userId: req.user.id, action: 'PRIORITY_RULE_DELETED', entityType: 'PriorityRule', entityId: id, ipAddress: req.ip });
  return new ApiResponse(200, null, 'Priority rule deleted').send(res);
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listPriorityRules, createPriorityRule, updatePriorityRule, deletePriorityRule,
};
