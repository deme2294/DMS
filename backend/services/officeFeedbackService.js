import { v4 as uuidv4 } from 'uuid';
import * as officeFeedbackRepo from '../repository/officeFeedbackRepository.js';
import * as officeFeedbackReplyRepo from '../repository/officeFeedbackReplyRepository.js';
import * as officeRepository from '../repository/officeRepository.js';
import * as userRepository from '../repository/userRepository.js';
import * as tenantRepository from '../repository/tenantRepository.js';
import { sendOfficeInquiryEmail, sendOfficeInquiryResponseEmail } from './emailService.js';
import pool from '../config/db.js';

export const listOfficeFeedback = async (officeLocationId) => {
  return officeFeedbackRepo.findByOffice(officeLocationId);
};

export const getOfficeFeedbackById = async (feedbackId) => {
  const feedback = await officeFeedbackRepo.findById(feedbackId);
  
  if (!feedback) {
    return null;
  }
  
  // Get additional details
  const [rows] = await pool.query(`
    SELECT 
      of.*,
      t.organization_name AS tenant_name,
      u.first_name,
      u.last_name,
      u.email AS user_email,
      ol.building,
      ol.floor,
      ol.office_number,
      ol.employee_name AS office_contact,
      ol.email AS office_email
    FROM office_feedback of
    LEFT JOIN tenants t ON t.id = of.tenant_id
    LEFT JOIN users u ON u.id = of.user_id
    LEFT JOIN office_locations ol ON ol.id = of.office_location_id
    WHERE of.id = ?
    LIMIT 1
  `, [feedbackId]);
  
  if (!rows || rows.length === 0) {
    return feedback;
  }
  
  const row = rows[0];
  return {
    id: row.id,
    officeLocationId: row.office_location_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    subject: row.subject,
    message: row.message,
    rating: row.rating,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tenantName: row.tenant_name,
    userName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
    userEmail: row.user_email,
    officeBuilding: row.building,
    officeFloor: row.floor,
    officeNumber: row.office_number,
    officeContact: row.office_contact,
    officeEmail: row.office_email,
  };
};

export const listAllOfficeFeedback = async (query) => {
  const { search = '', status = '', page = 1, limit = 50 } = query;
  const offset = (Number(page) - 1) * Number(limit);
  
  let sql = `
    SELECT 
      of.*,
      t.organization_name AS tenant_name,
      u.first_name,
      u.last_name,
      u.email AS user_email,
      ol.building,
      ol.floor,
      ol.office_number,
      ol.employee_name AS office_contact
    FROM office_feedback of
    LEFT JOIN tenants t ON t.id = of.tenant_id
    LEFT JOIN users u ON u.id = of.user_id
    LEFT JOIN office_locations ol ON ol.id = of.office_location_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (search) {
    sql += ` AND (of.subject LIKE ? OR of.message LIKE ? OR t.organization_name LIKE ? OR ol.building LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  
  if (status) {
    sql += ` AND of.status = ?`;
    params.push(status);
  }
  
  sql += ` ORDER BY of.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);
  
  const [rows] = await pool.query(sql, params);
  
  return rows.map(row => ({
    id: row.id,
    officeLocationId: row.office_location_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    subject: row.subject,
    message: row.message,
    rating: row.rating,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tenantName: row.tenant_name,
    userName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
    userEmail: row.user_email,
    officeBuilding: row.building,
    officeFloor: row.floor,
    officeNumber: row.office_number,
    officeContact: row.office_contact,
  }));
};

export const createOfficeFeedback = async (data, user) => {
  const tenantId = user.tenant_id;
  if (!tenantId) {
    throw Object.assign(new Error('No tenant account linked to this user'), { statusCode: 400 });
  }

  const feedback = {
    id: uuidv4(),
    officeLocationId: data.officeLocationId,
    tenantId,
    userId: user.id,
    subject: data.subject,
    message: data.message,
    rating: data.rating ? Number(data.rating) : null,
    status: 'pending',
  };

  await officeFeedbackRepo.create(feedback);
  
  // Send email notification to office owner
  try {
    // Get office location details
    const office = await officeRepository.findById(data.officeLocationId);
    
    if (office && office.email) {
      // Get tenant organization name
      const tenant = await tenantRepository.findById(tenantId);
      
      // Get user details
      const inquiryUser = await userRepository.findById(user.id);
      
      // Send email to office owner
      await sendOfficeInquiryEmail({
        ownerEmail: office.email,
        ownerName: office.employee_name || 'Office Manager',
        tenantName: inquiryUser ? `${inquiryUser.first_name} ${inquiryUser.last_name}` : 'Tenant User',
        tenantEmail: inquiryUser ? inquiryUser.email : '',
        office: {
          building: office.building,
          floor: office.floor,
          office_number: office.office_number,
          description: office.description,
        },
        subject: data.subject,
        message: data.message,
      });
      
      console.log(`📧 Office inquiry email sent to ${office.email}`);
    }
  } catch (emailError) {
    // Log email error but don't fail the feedback creation
    console.error('Failed to send office inquiry email:', emailError.message);
  }
  
  return officeFeedbackRepo.findById(feedback.id);
};

export const updateOfficeFeedback = async (id, fields, adminId = null) => {
  const feedback = await officeFeedbackRepo.findById(id);
  if (!feedback) {
    throw Object.assign(new Error('Office feedback not found'), { statusCode: 404 });
  }
  
  // Prepare update fields
  const updateData = {};
  const allowedFields = ['subject', 'message', 'rating', 'status'];
  
  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      updateData[key] = fields[key];
    }
  }
  
  // If status is being updated to 'resolved' or 'closed', add admin response fields
  if (fields.adminResponse || fields.admin_response) {
    updateData.admin_response = fields.adminResponse || fields.admin_response;
  }
  
  if (fields.responseAt || fields.response_at) {
    updateData.response_at = fields.responseAt || fields.response_at;
  } else if (fields.adminResponse || fields.admin_response) {
    updateData.response_at = new Date();
  }
  
  if (adminId && (fields.adminResponse || fields.admin_response)) {
    updateData.response_by = adminId;
  }
  
  // Perform update
  await officeFeedbackRepo.update(id, updateData);
  
  // Send email if status changed to resolved/closed and admin response is provided
  if ((fields.status === 'resolved' || fields.status === 'closed') && updateData.admin_response) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          of.*,
          u.first_name, u.last_name, u.email AS user_email,
          ol.building, ol.floor, ol.office_number,
          admin.first_name AS admin_first_name,
          admin.last_name AS admin_last_name
        FROM office_feedback of
        LEFT JOIN users u ON u.id = of.user_id
        LEFT JOIN office_locations ol ON ol.id = of.office_location_id
        LEFT JOIN users admin ON admin.id = ?
        WHERE of.id = ?
        LIMIT 1
      `, [adminId || feedback.user_id, id]);
      
      if (rows && rows.length > 0) {
        const feedbackData = rows[0];
        
        await sendOfficeInquiryResponseEmail({
          tenantEmail: feedbackData.user_email,
          tenantName: feedbackData.first_name && feedbackData.last_name 
            ? `${feedbackData.first_name} ${feedbackData.last_name}` 
            : 'Tenant User',
          adminName: feedbackData.admin_first_name && feedbackData.admin_last_name
            ? `${feedbackData.admin_first_name} ${feedbackData.admin_last_name}`
            : 'System Admin',
          office: {
            building: feedbackData.building,
            floor: feedbackData.floor,
            office_number: feedbackData.office_number,
          },
          originalSubject: feedbackData.subject,
          originalMessage: feedbackData.message,
          responseMessage: updateData.admin_response,
        });
        
        console.log(`📧 Office feedback resolution email sent to ${feedbackData.user_email}`);
      }
    } catch (emailError) {
      console.error('Failed to send office feedback resolution email:', emailError.message);
    }
  }
  
  return officeFeedbackRepo.findById(id);
};

export const deleteOfficeFeedback = async (id) => {
  await officeFeedbackRepo.remove(id);
};

export const getOfficeFeedbackReplies = async (feedbackId) => {
  return officeFeedbackReplyRepo.findByFeedback(feedbackId);
};

export const replyOfficeFeedback = async (feedbackId, repliedBy, message) => {
  const feedback = await officeFeedbackRepo.findById(feedbackId);
  if (!feedback) {
    throw Object.assign(new Error('Office feedback not found'), { statusCode: 404 });
  }
  
  if (!message?.trim()) {
    throw Object.assign(new Error('Reply message is required'), { statusCode: 400 });
  }
  
  const reply = {
    id: uuidv4(),
    officeFeedbackId: feedbackId,
    repliedBy,
    message: message.trim(),
  };
  
  await officeFeedbackReplyRepo.create(reply);
  
  // Update feedback status to 'read' if it was 'pending'
  if (feedback.status === 'pending') {
    await officeFeedbackRepo.update(feedbackId, { status: 'read' });
  }
  
  // Send email notification to tenant
  try {
    // Get feedback details with office and user info
    const [rows] = await pool.query(`
      SELECT 
        of.*,
        u.first_name, u.last_name, u.email AS user_email,
        ol.building, ol.floor, ol.office_number,
        admin.first_name AS admin_first_name,
        admin.last_name AS admin_last_name
      FROM office_feedback of
      LEFT JOIN users u ON u.id = of.user_id
      LEFT JOIN office_locations ol ON ol.id = of.office_location_id
      LEFT JOIN users admin ON admin.id = ?
      WHERE of.id = ?
      LIMIT 1
    `, [repliedBy, feedbackId]);
    
    if (rows && rows.length > 0) {
      const feedbackData = rows[0];
      
      await sendOfficeInquiryResponseEmail({
        tenantEmail: feedbackData.user_email,
        tenantName: feedbackData.first_name && feedbackData.last_name 
          ? `${feedbackData.first_name} ${feedbackData.last_name}` 
          : 'Tenant User',
        adminName: feedbackData.admin_first_name && feedbackData.admin_last_name
          ? `${feedbackData.admin_first_name} ${feedbackData.admin_last_name}`
          : 'Administrator',
        office: {
          building: feedbackData.building,
          floor: feedbackData.floor,
          office_number: feedbackData.office_number,
        },
        originalSubject: feedbackData.subject,
        originalMessage: feedbackData.message,
        responseMessage: message.trim(),
      });
      
      console.log(`📧 Office inquiry response email sent to ${feedbackData.user_email}`);
    }
  } catch (emailError) {
    console.error('Failed to send office inquiry response email:', emailError.message);
  }
  
  return officeFeedbackReplyRepo.findByFeedback(feedbackId);
};

export const getTenantOfficeFeedback = async (tenantId, filters = {}) => {
  const { search = '', status = '', page = 1, limit = 50 } = filters;
  const offset = (Number(page) - 1) * Number(limit);
  
  let sql = `
    SELECT 
      of.*,
      ol.building,
      ol.floor,
      ol.office_number,
      ol.employee_name AS office_contact
    FROM office_feedback of
    LEFT JOIN office_locations ol ON ol.id = of.office_location_id
    WHERE of.tenant_id = ?
  `;
  
  const params = [tenantId];
  
  if (search) {
    sql += ` AND (of.subject LIKE ? OR of.message LIKE ? OR ol.building LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  
  if (status) {
    sql += ` AND of.status = ?`;
    params.push(status);
  }
  
  sql += ` ORDER BY of.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), offset);
  
  const [rows] = await pool.query(sql, params);
  
  return rows.map(row => ({
    id: row.id,
    officeLocationId: row.office_location_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    subject: row.subject,
    message: row.message,
    rating: row.rating,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    officeBuilding: row.building,
    officeFloor: row.floor,
    officeNumber: row.office_number,
    officeContact: row.office_contact,
  }));
};
