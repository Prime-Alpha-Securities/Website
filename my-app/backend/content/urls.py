from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HeroSectionViewSet, SectionViewSet, FeatureViewSet,
    TestimonialViewSet, CallToActionViewSet, SiteSettingsViewSet
)

router = DefaultRouter()
router.register(r'hero', HeroSectionViewSet, basename='hero')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'features', FeatureViewSet, basename='feature')
router.register(r'testimonials', TestimonialViewSet, basename='testimonial')
router.register(r'cta', CallToActionViewSet, basename='cta')
router.register(r'settings', SiteSettingsViewSet, basename='settings')

urlpatterns = [
    path('', include(router.urls)),
]
