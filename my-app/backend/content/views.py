from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from .models import HeroSection, Section, Feature, Testimonial, CallToAction, SiteSettings
from .serializers import (
    HeroSectionSerializer, SectionSerializer, FeatureSerializer,
    TestimonialSerializer, CallToActionSerializer, SiteSettingsSerializer
)


class HeroSectionViewSet(viewsets.ModelViewSet):
    queryset = HeroSection.objects.all()
    serializer_class = HeroSectionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.filter(published=True).order_by('order')
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'


class FeatureViewSet(viewsets.ModelViewSet):
    queryset = Feature.objects.all().order_by('order')
    serializer_class = FeatureSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class TestimonialViewSet(viewsets.ModelViewSet):
    queryset = Testimonial.objects.all().order_by('order')
    serializer_class = TestimonialSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class CallToActionViewSet(viewsets.ModelViewSet):
    queryset = CallToAction.objects.all()
    serializer_class = CallToActionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class SiteSettingsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def list(self, request):
        settings = SiteSettings.objects.first() or SiteSettings()
        serializer = SiteSettingsSerializer(settings)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        settings = SiteSettings.objects.first() or SiteSettings()
        serializer = SiteSettingsSerializer(settings)
        return Response(serializer.data)

    def update(self, request, pk=None):
        settings = SiteSettings.objects.first() or SiteSettings()
        serializer = SiteSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
