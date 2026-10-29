import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../config/apiConfig';
import Toast from 'react-native-toast-message';

/**
 * Download or share the professionally styled A4 Excel sheet from backend.
 * Supports exporting all users or selected users.
 * Works seamlessly across Web, Android, and iOS.
 *
 * @param {Object} options
 * @param {Array<string>} [options.userIds] Optional list of user IDs to export
 * @param {string} options.token Auth session access token
 * @returns {Promise<boolean>} Success status
 */
export async function downloadUsersExcelFile({ userIds = null, token }) {
  if (!token) {
    Toast.show({ type: 'error', text1: 'Authentication Error', text2: 'Please log in again.' });
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/users/export-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userIds: Array.isArray(userIds) && userIds.length > 0 ? userIds : undefined,
        returnBase64: true,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to generate Excel file');
    }

    if (!result.base64) {
      throw new Error('No Excel data received from server');
    }

    const fileName = result.fileName || `Shari_Jamate_Ahle_Hadith_Users_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const recordCount = result.count || 0;

    // -------------------------------------------------------------
    // Web Browser Download
    // -------------------------------------------------------------
    if (Platform.OS === 'web') {
      try {
        const byteCharacters = atob(result.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Toast.show({
          type: 'success',
          text1: 'Excel Downloaded!',
          text2: `${recordCount} user(s) exported successfully in A4 format.`,
        });
        return true;
      } catch (webErr) {
        console.error('Web download error:', webErr);
        // Fallback for web using data URI
        const link = document.createElement('a');
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.base64}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Toast.show({
          type: 'success',
          text1: 'Excel Downloaded!',
          text2: `${recordCount} user(s) exported.`,
        });
        return true;
      }
    }

    // -------------------------------------------------------------
    // Native Mobile (Android & iOS) Save & Share
    // -------------------------------------------------------------
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(fileUri, result.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Shari Jamate Ahle Hadith - Users Excel',
        UTI: 'com.microsoft.excel.xlsx',
      });
    }

    Toast.show({
      type: 'success',
      text1: 'Excel File Ready!',
      text2: `${recordCount} user(s) exported successfully in A4 format.`,
    });
    return true;
  } catch (err) {
    console.error('Excel Export Error:', err);
    Toast.show({
      type: 'error',
      text1: 'Export Failed',
      text2: err.message || 'Could not download Excel file',
    });
    return false;
  }
}
