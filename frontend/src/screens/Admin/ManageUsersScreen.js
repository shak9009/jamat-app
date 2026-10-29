import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../../config/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/apiConfig';
import { downloadUsersExcelFile } from '../../services/excelExportService';
import { useAuth } from '../../context/AuthContext';

export default function ManageUsersScreen({ navigation }) {
  const { role } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (role === 'master_admin') {
      fetchUsers();
    }
  }, [role]);

  if (role !== 'master_admin') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f9f5', padding: 24 }}>
        <Ionicons name="shield-outline" size={64} color="#e74c3c" style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 8, textAlign: 'center' }}>
          Access Restricted
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
          Only Master Admin has permission to view and manage registered users.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#1b6b3c', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 }}
          onPress={() => navigation?.goBack()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${API_URL}/api/admin/all-users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to fetch users');

      const fetchedUsers = result.users || [];
      setUsers(fetchedUsers);
      applyFilter(searchQuery, fetchedUsers);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch registered users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const applyFilter = (query, list = users) => {
    if (!query.trim()) {
      setFilteredUsers(list);
      return;
    }
    const lowerText = query.toLowerCase();
    const filtered = list.filter(user => 
      (user.name && user.name.toLowerCase().includes(lowerText)) ||
      (user.occupation && user.occupation.toLowerCase().includes(lowerText)) ||
      (user.email && user.email.toLowerCase().includes(lowerText)) ||
      (user.phone && user.phone.includes(lowerText)) ||
      (user.aadhaar && user.aadhaar.includes(lowerText))
    );
    setFilteredUsers(filtered);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    applyFilter(text);
  };

  // -------------------------------------------------------------
  // Multi-Selection Logic
  // -------------------------------------------------------------
  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.has(u.id));
  const isPartiallySelected = selectedUsers.size > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // If already all selected, clear selection
      setSelectedUsers(new Set());
    } else {
      // Select all currently filtered users
      const newSet = new Set(selectedUsers);
      filteredUsers.forEach(u => newSet.add(u.id));
      setSelectedUsers(newSet);
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
  };

  // -------------------------------------------------------------
  // Bulk Actions
  // -------------------------------------------------------------
  const handleBulkDelete = () => {
    if (selectedUsers.size === 0) return;
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${selectedUsers.size} user(s)? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performBulkDelete }
      ]
    );
  };

  const performBulkDelete = async () => {
    setIsDeleting(true);
    const toDeleteIds = Array.from(selectedUsers);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/admin/users/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userIds: toDeleteIds })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to delete users');
      
      // Optimistically remove from state immediately
      const deletedSet = new Set(toDeleteIds);
      setUsers(prev => prev.filter(u => !deletedSet.has(u.id)));
      setFilteredUsers(prev => prev.filter(u => !deletedSet.has(u.id)));
      setSelectedUsers(new Set());

      Alert.alert('Success', `Successfully deleted ${result.deletedCount || toDeleteIds.length} user(s).`);
      fetchUsers();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportExcel = async (onlySelected = false) => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const idsToExport = (onlySelected && selectedUsers.size > 0) ? Array.from(selectedUsers) : null;
      await downloadUsersExcelFile({ userIds: idsToExport, token });
    } catch (e) {
      console.error(e);
      Alert.alert('Export Error', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  // -------------------------------------------------------------
  // Render Item
  // -------------------------------------------------------------
  const renderItem = ({ item }) => {
    const isSelected = selectedUsers.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => toggleSelection(item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.checkboxTouch}
            onPress={() => toggleSelection(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons 
              name={isSelected ? "checkbox" : "square-outline"} 
              size={24} 
              color={isSelected ? "#1b6b3c" : "#bdc3c7"} 
            />
          </TouchableOpacity>

          <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
            <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
              {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>

          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{item.name || 'Unknown User'}</Text>
            <Text style={styles.userDate}>
              Joined: {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
            </Text>
          </View>
        </View>
        
        <View style={[styles.detailsContainer, isSelected && styles.detailsContainerSelected]}>
          <View style={styles.detailRow}>
            <Ionicons name="call" size={15} color="#1b6b3c" />
            <Text style={styles.detailText}>{item.phone || 'No phone number'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="mail" size={15} color="#1b6b3c" />
            <Text style={styles.detailText} numberOfLines={1}>{item.email || 'No email'}</Text>
          </View>
          {item.occupation && (
            <View style={styles.detailRow}>
              <Ionicons name="briefcase" size={15} color="#1b6b3c" />
              <Text style={styles.detailText}>Occupation: {item.occupation}</Text>
            </View>
          )}
          {item.aadhaar && (
            <View style={styles.detailRow}>
              <Ionicons name="card" size={15} color="#1b6b3c" />
              <Text style={styles.detailText}>Aadhaar: {item.aadhaar}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#7f8c8d" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, occupation, phone, email, or aadhaar..."
          placeholderTextColor="#95a5a6"
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color="#7f8c8d" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats and Multi-Select Control Card */}
      <View style={styles.headerCard}>
        {/* Top Summary Row */}
        <View style={styles.statsRow}>
          <View style={styles.statsBadge}>
            <Ionicons name="people" size={16} color="#1b6b3c" style={{ marginRight: 6 }} />
            <Text style={styles.statsText}>
              Total Users: <Text style={{ color: '#1b6b3c', fontWeight: '800' }}>{users.length}</Text>
            </Text>
          </View>

          {selectedUsers.size > 0 && (
            <View style={styles.selectedCountBadge}>
              <Text style={styles.selectedCountText}>
                {selectedUsers.size} of {filteredUsers.length} Selected
              </Text>
              <TouchableOpacity onPress={clearSelection} style={{ marginLeft: 6 }}>
                <Ionicons name="close-circle" size={16} color="#e74c3c" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Multi-Select & Action Row */}
        <View style={styles.selectionBar}>
          {/* Select All Checkbox Button */}
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={toggleSelectAll}
            disabled={filteredUsers.length === 0}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isAllSelected ? "checkbox" : (isPartiallySelected ? "remove-circle" : "square-outline")}
              size={22}
              color={isAllSelected ? "#1b6b3c" : (isPartiallySelected ? "#e67e22" : "#7f8c8d")}
            />
            <Text style={[styles.selectAllText, isAllSelected && styles.selectAllTextActive]}>
              {isAllSelected ? 'Deselect All' : `Select All (${filteredUsers.length})`}
            </Text>
          </TouchableOpacity>

          {/* Action Buttons: Export Excel & Bulk Delete */}
          <View style={styles.actionsWrap}>
            {/* Export Excel Button */}
            <TouchableOpacity
              style={[styles.exportBtn, isExporting && { opacity: 0.7 }]}
              onPress={() => handleExportExcel(selectedUsers.size > 0)}
              disabled={isExporting}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text" size={15} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.exportBtnText}>
                    {selectedUsers.size > 0 ? `Export (${selectedUsers.size})` : 'Export All'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Bulk Delete Button */}
            {selectedUsers.size > 0 && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleBulkDelete}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={15} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Users List */}
      {loading ? (
        <ActivityIndicator size="large" color="#1b6b3c" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1b6b3c']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching users found.' : 'No registered users found.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f9f5', padding: 16 },
  
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e2ece4',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#2c3e50' },

  // Header & Controls Card
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e2ece4',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f5f1',
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: { fontSize: 13, color: '#333', fontWeight: '600' },
  selectedCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6e8d1',
  },
  selectedCountText: { fontSize: 12, fontWeight: '700', color: '#1b6b3c' },

  // Multi-Selection Bar
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginLeft: 8,
  },
  selectAllTextActive: {
    color: '#1b6b3c',
    fontWeight: '800',
  },
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b6b3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#1b6b3c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  exportBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  // User Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
    borderWidth: 1,
    borderColor: '#e8f0eb',
  },
  cardSelected: {
    backgroundColor: '#f6fbf8',
    borderLeftColor: '#1b6b3c',
    borderColor: '#cde8d6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxTouch: {
    marginRight: 10,
    padding: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eaf4fc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSelected: {
    backgroundColor: '#e8f5e9',
  },
  avatarText: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#3498db',
  },
  avatarTextSelected: {
    color: '#1b6b3c',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 11,
    color: '#95a5a6',
    fontWeight: '500',
  },

  // Details inside Card
  detailsContainer: {
    backgroundColor: '#f9fbfb',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f0f5f2',
  },
  detailsContainerSelected: {
    backgroundColor: '#f1f8f4',
    borderColor: '#e0f0e6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#34495e',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 15, fontSize: 15, fontWeight: '500' }
});
