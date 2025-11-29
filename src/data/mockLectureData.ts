import type { Class, UserProgress } from '../types/lectureTypes';

export const mockClasses: Class[] = [
    {
        id: 'arduino-fundamentals',
        title: 'Arduino Fundamentals',
        instructor: 'Dr. Sarah Chen',
        thumbnail: 'https://images.unsplash.com/photo-1553406830-ef2513450d76?w=800&h=600&fit=crop',
        description: 'Master the basics of Arduino programming and circuit design',
        category: 'Microcontrollers',
        totalLessons: 12,
        completedLessons: 7,
        progressPercentage: 58,
        modules: [
            {
                id: 'module-1',
                title: 'Getting Started with Arduino',
                lessons: [
                    {
                        id: 'lesson-1',
                        title: 'Introduction to Arduino',
                        type: 'video',
                        duration: 15,
                        description: 'Learn what Arduino is and what you can build with it',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        resources: [
                            {
                                id: 'res-1',
                                name: 'Arduino Introduction.pdf',
                                type: 'pdf',
                                url: '#',
                                size: '2.5 MB'
                            },
                            {
                                id: 'res-2',
                                name: 'Quick Reference Guide.pdf',
                                type: 'pdf',
                                url: '#',
                                size: '1.8 MB'
                            }
                        ],
                        completed: true
                    },
                    {
                        id: 'lesson-2',
                        title: 'Setting Up Your Environment',
                        type: 'video',
                        duration: 20,
                        description: 'Install and configure the Arduino IDE',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                        resources: [
                            {
                                id: 'res-3',
                                name: 'IDE Setup Guide.pdf',
                                type: 'pdf',
                                url: '#',
                                size: '3.2 MB'
                            }
                        ],
                        completed: true
                    },
                    {
                        id: 'lesson-3',
                        title: 'Your First Blink Program',
                        type: 'coding',
                        duration: 30,
                        description: 'Write and upload your first Arduino program',
                        completed: true
                    }
                ]
            },
            {
                id: 'module-2',
                title: 'Digital I/O and Sensors',
                lessons: [
                    {
                        id: 'lesson-4',
                        title: 'Understanding Digital Pins',
                        type: 'video',
                        duration: 18,
                        description: 'Learn how to use digital input and output pins',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                        completed: true
                    },
                    {
                        id: 'lesson-5',
                        title: 'Button and LED Circuit',
                        type: 'coding',
                        duration: 25,
                        description: 'Build a circuit that controls an LED with a button',
                        completed: true
                    },
                    {
                        id: 'lesson-6',
                        title: 'Working with Sensors',
                        type: 'video',
                        duration: 22,
                        description: 'Introduction to common Arduino sensors',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                        completed: true
                    },
                    {
                        id: 'lesson-7',
                        title: 'Temperature Sensor Project',
                        type: 'coding',
                        duration: 35,
                        description: 'Read and display temperature data',
                        completed: true
                    }
                ]
            },
            {
                id: 'module-3',
                title: 'Analog I/O and Communication',
                lessons: [
                    {
                        id: 'lesson-8',
                        title: 'Analog vs Digital Signals',
                        type: 'video',
                        duration: 16,
                        description: 'Understanding the difference between analog and digital',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
                        completed: false
                    },
                    {
                        id: 'lesson-9',
                        title: 'Reading Analog Sensors',
                        type: 'coding',
                        duration: 28,
                        description: 'Use analogRead to get sensor values',
                        completed: false
                    },
                    {
                        id: 'lesson-10',
                        title: 'Serial Communication',
                        type: 'video',
                        duration: 20,
                        description: 'Communicate with your computer via serial',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
                        completed: false
                    },
                    {
                        id: 'lesson-11',
                        title: 'Final Project: Weather Station',
                        type: 'project',
                        duration: 60,
                        description: 'Build a complete weather monitoring station',
                        completed: false
                    }
                ]
            }
        ]
    },
    {
        id: 'iot-essentials',
        title: 'IoT Essentials',
        instructor: 'Prof. Marcus Lee',
        thumbnail: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=800&h=600&fit=crop',
        description: 'Connect your devices to the Internet of Things',
        category: 'IoT',
        totalLessons: 10,
        completedLessons: 2,
        progressPercentage: 20,
        modules: [
            {
                id: 'iot-module-1',
                title: 'Introduction to IoT',
                lessons: [
                    {
                        id: 'iot-lesson-1',
                        title: 'What is IoT?',
                        type: 'video',
                        duration: 12,
                        description: 'Understanding the Internet of Things ecosystem',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        completed: true
                    },
                    {
                        id: 'iot-lesson-2',
                        title: 'IoT Protocols Overview',
                        type: 'video',
                        duration: 18,
                        description: 'MQTT, HTTP, CoAP and other IoT protocols',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                        completed: true
                    },
                    {
                        id: 'iot-lesson-3',
                        title: 'Your First IoT Device',
                        type: 'coding',
                        duration: 40,
                        description: 'Connect an ESP32 to the cloud',
                        completed: false
                    }
                ]
            }
        ]
    },
    {
        id: 'embedded-ui-design',
        title: 'Embedded UI Design',
        instructor: 'Emma Rodriguez',
        thumbnail: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&h=600&fit=crop',
        description: 'Design beautiful user interfaces for embedded displays',
        category: 'UI/UX',
        totalLessons: 8,
        completedLessons: 0,
        progressPercentage: 0,
        modules: [
            {
                id: 'ui-module-1',
                title: 'UI Fundamentals',
                lessons: [
                    {
                        id: 'ui-lesson-1',
                        title: 'Display Technologies',
                        type: 'video',
                        duration: 15,
                        description: 'LCD, OLED, and E-ink displays explained',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                        completed: false
                    },
                    {
                        id: 'ui-lesson-2',
                        title: 'Design Principles for Small Screens',
                        type: 'video',
                        duration: 20,
                        description: 'Creating effective interfaces with limited space',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
                        completed: false
                    },
                    {
                        id: 'ui-lesson-3',
                        title: 'Design Your First Screen',
                        type: 'design',
                        duration: 35,
                        description: 'Create a menu interface for an embedded device',
                        completed: false
                    }
                ]
            }
        ]
    },
    {
        id: 'rtos-basics',
        title: 'Real-Time Operating Systems',
        instructor: 'Dr. James Park',
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop',
        description: 'Master multitasking with FreeRTOS',
        category: 'Advanced',
        totalLessons: 15,
        completedLessons: 0,
        progressPercentage: 0,
        modules: [
            {
                id: 'rtos-module-1',
                title: 'RTOS Fundamentals',
                lessons: [
                    {
                        id: 'rtos-lesson-1',
                        title: 'What is an RTOS?',
                        type: 'video',
                        duration: 18,
                        description: 'Introduction to real-time operating systems',
                        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
                        completed: false
                    }
                ]
            }
        ]
    }
];

export const mockUserProgress: UserProgress = {
    lastStudiedClassId: 'arduino-fundamentals',
    lastStudiedLessonId: 'lesson-7',
    totalLessonsCompleted: 9,
    totalStudyHours: 12.5,
    currentStreak: 5,
    completionRate: 32
};
