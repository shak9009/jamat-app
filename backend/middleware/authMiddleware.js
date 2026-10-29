const { supabase } = require('../config/supabaseClient');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      throw error || new Error("User not found");
    }

    req.user = user;
    req.user.uid = user.id;
    
    const { data: userDoc, error: dbError } = await supabase.from('users').select('*').eq('id', user.id).single();
    
    if (!dbError && userDoc) {
      req.user.role = userDoc.role || 'user';
      req.user.dbData = userDoc;
    } else {
      req.user.role = 'user';
    }
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'master_admin')) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
};

const requireMasterAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'master_admin') {
    return res.status(403).json({ error: 'Forbidden: Master Admin access required' });
  }
  next();
};

module.exports = { verifyToken, requireAuth, requireAdmin, requireMasterAdmin };
