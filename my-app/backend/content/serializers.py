from rest_framework import serializers
from .models import HeroSection, Section, Feature, Testimonial, CallToAction, SiteSettings


class HeroSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSection
        fields = '__all__'


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = '__all__'


class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = '__all__'


class TestimonialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = '__all__'


class CallToActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallToAction
        fields = '__all__'


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = '__all__'
