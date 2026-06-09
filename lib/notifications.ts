import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Cricket Coach',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1a6b3c',
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export async function scheduleAttendanceReminder(): Promise<void> {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const hasReminder = existing.some((n) => n.content.data?.type === 'attendance_reminder');
  if (hasReminder) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🏏 Mark Attendance',
      body: "Don't forget to take today's attendance!",
      sound: true,
      data: { type: 'attendance_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
}

export async function sendOverdueAlert(studentName: string, daysOverdue: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚠️ Overdue Fee',
      body: `${studentName} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue on payment.`,
      sound: true,
      data: { type: 'fee_overdue' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      repeats: false,
    },
  });
}

export async function sendAbsenceAlert(studentName: string, count: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 Absence Alert',
      body: `${studentName} has missed ${count} consecutive sessions.`,
      sound: true,
      data: { type: 'absence_alert' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      repeats: false,
    },
  });
}

export async function sendFeeReminder(studentName: string, daysUntilDue: number): Promise<void> {
  const body =
    daysUntilDue === 0
      ? `${studentName}'s fee is due today.`
      : `${studentName}'s fee is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💰 Fee Due',
      body,
      sound: true,
      data: { type: 'fee_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      repeats: false,
    },
  });
}
